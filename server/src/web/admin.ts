import type http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { accountByToken, pool, type AccountRow } from "../db.ts";
import { getGood, loadShop } from "../shared/shop.ts";
import { AccountApiError } from "./accounts/accounts.ts";

export interface AdminResult { status?: number; body: unknown }

function bearer(req: http.IncomingMessage): string {
  const value = req.headers.authorization ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

async function requireAdmin(req: http.IncomingMessage): Promise<AccountRow> {
  const account = await accountByToken(bearer(req));
  if (!account) throw new AccountApiError(401, "admin sessiyası etibarsızdır");
  if (account.access < 100) throw new AccountApiError(403, "yalnız GM hesabları daxil ola bilər");
  return account;
}

const cleanQuery = (value: string | null) => (value ?? "").trim().slice(0, 64);
const supportedWeaponIds = (() => {
  try {
    const file = fileURLToPath(new URL("../../../public/assets/weapons/complete-cross.json", import.meta.url));
    const body = JSON.parse(readFileSync(file, "utf8")) as { complete?: number[] };
    return (body.complete ?? []).filter(Number.isInteger);
  } catch { return [] as number[]; }
})();
const page = (url: URL) => ({
  limit: Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 30)),
  offset: Math.max(0, Number(url.searchParams.get("offset")) || 0),
});

function objectBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccountApiError(400, "yanlış məlumat formatı");
  return body as Record<string, unknown>;
}

function integer(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AccountApiError(400, `${name} düzgün deyil`);
  }
  return value;
}

async function audit(admin: AccountRow, req: http.IncomingMessage, category: string, description: string): Promise<void> {
  await pool.query(
    `INSERT INTO web_adminpanel_log (description, category, date, ip_address) VALUES ($1,$2,$3,$4)`,
    [`${admin.username} (${admin.playerId}): ${description}`, category, new Date().toISOString(), req.socket.remoteAddress ?? ""],
  );
}

async function users(url: URL): Promise<AdminResult> {
  const q = cleanQuery(url.searchParams.get("q"));
  const { limit, offset } = page(url);
  const filter = q ? `WHERE username ILIKE $1 OR nickname ILIKE $1 OR player_id::text=$2` : "";
  const params = q ? [`%${q}%`, q] : [];
  const count = await pool.query(`SELECT count(*) AS total FROM accounts ${filter}`, params);
  const rows = await pool.query(
    `SELECT player_id, username, nickname, rank, experience, gold, cash, access_level, online, created_at
       FROM accounts ${filter} ORDER BY player_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { body: { total: Number(count.rows[0]?.total ?? 0), users: rows.rows.map((x) => ({ ...x, player_id: String(x.player_id) })) } };
}

async function updateUser(req: http.IncomingMessage, admin: AccountRow, id: string, raw: unknown): Promise<AdminResult> {
  if (!/^\d+$/.test(id)) throw new AccountApiError(400, "istifadəçi ID-si düzgün deyil");
  const input = objectBody(raw);
  const values: unknown[] = [];
  const sets: string[] = [];
  const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column}=$${values.length}`); };
  if ("nickname" in input) {
    const nickname = String(input.nickname ?? "").trim();
    if (nickname.length < 2 || nickname.length > 16) throw new AccountApiError(400, "ləqəb 2–16 simvol olmalıdır");
    add("nickname", nickname);
  }
  if ("rank" in input) add("rank", integer(input.rank, "rütbə", 0, 255));
  if ("experience" in input) add("experience", integer(input.experience, "təcrübə", 0, 2147483647));
  if ("gold" in input) add("gold", integer(input.gold, "point", 0, 2147483647));
  if ("cash" in input) add("cash", integer(input.cash, "NG", 0, 2147483647));
  if ("access_level" in input) {
    const access = integer(input.access_level, "giriş səviyyəsi", -1, 100);
    if (String(admin.playerId) === id && access < 100) throw new AccountApiError(400, "öz GM səlahiyyətinizi söndürə bilməzsiniz");
    add("access_level", access);
  }
  if (!sets.length) throw new AccountApiError(400, "dəyişiklik yoxdur");
  values.push(id);
  try {
    const result = await pool.query(
      `UPDATE accounts SET ${sets.join(", ")} WHERE player_id=$${values.length}
       RETURNING player_id, username, nickname, rank, experience, gold, cash, access_level, online, created_at`, values,
    );
    if (!result.rows[0]) throw new AccountApiError(404, "istifadəçi tapılmadı");
    await audit(admin, req, "users", `istifadəçi ${id} yeniləndi: ${sets.join(", ")}`);
    return { body: { user: { ...result.rows[0], player_id: String(result.rows[0].player_id) } } };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      throw new AccountApiError(409, "bu ləqəb artıq istifadə olunur");
    }
    throw err;
  }
}

async function shopItems(url: URL): Promise<AdminResult> {
  const q = cleanQuery(url.searchParams.get("q"));
  const category = cleanQuery(url.searchParams.get("category")) || "all";
  const support = cleanQuery(url.searchParams.get("support")) || "all";
  const visibility = cleanQuery(url.searchParams.get("visibility")) || "all";
  // Keep the initial catalog light, but an explicit search must not silently
  // hide matching weapons after the first 30/100 rows.
  const requested = Number(url.searchParams.get("limit")) || 30;
  const limit = Math.min(5000, Math.max(1, requested));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const categories: Record<string, string> = {
    all: "TRUE",
    weapons: "(item_id / 100000) IN (1,2,4,5)",
    knives: "(item_id / 100000) = 3",
    characters: "(item_id / 100000) = 6",
    masks: "(item_id / 100000) = 8",
    accessories: "((item_id / 100000) BETWEEN 7 AND 14 OR (item_id / 100000) = 27 OR (item_id / 100000) BETWEEN 30 AND 35)",
    boxes: "((item_id / 100000) = 28)",
    packages: "((item_id / 100000) IN (36,37,38,39,40) OR item_name ILIKE 'SET_%')",
    special: "((item_id / 100000) IN (15,16,17,18,20,22,26) OR (item_id / 100000) > 40)",
  };
  const categorySql = categories[category];
  if (!categorySql) throw new AccountApiError(400, "məhsul kateqoriyası düzgün deyil");
  if (!["all", "supported", "missing"].includes(support)) throw new AccountApiError(400, "uyğunluq filtri düzgün deyil");
  if (!["all", "active", "hidden"].includes(visibility)) throw new AccountApiError(400, "görünürlük filtri düzgün deyil");
  const params: unknown[] = [];
  const conditions = [categorySql];
  if (q) {
    params.push(`%${q}%`, q);
    conditions.push(`(item_name ILIKE $${params.length - 1} OR item_id::text=$${params.length})`);
  }
  if (support !== "all") {
    params.push(supportedWeaponIds);
    const known = `item_id = ANY($${params.length}::int[])`;
    conditions.push(support === "supported"
      ? `(item_id < 100000 OR item_id >= 1700000 OR ${known})`
      : `(item_id >= 100000 AND item_id < 1700000 AND NOT (${known}))`);
  }
  if (visibility === "active") conditions.push("item_visible = TRUE");
  if (visibility === "hidden") conditions.push("item_visible = FALSE");
  const filter = `WHERE ${conditions.join(" AND ")}`;
  const count = await pool.query(`SELECT count(*) AS total FROM system_shop ${filter}`, params);
  const rows = await pool.query(
    `SELECT item_id, item_name, item_consume, "Item_count_list" AS item_count_list, price_cash_list,
            price_gold_list, item_visible, discount_percent, shop_tag, start_date, end_date
       FROM system_shop ${filter} ORDER BY item_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { body: { total: Number(count.rows[0]?.total ?? 0), items: rows.rows } };
}

async function battleBoxDetails(id: string): Promise<AdminResult> {
  if (!/^28\d{5}$/.test(id)) throw new AccountApiError(400, "qutu ID-si düzgün deyil");
  const box = (await pool.query(`SELECT coupon_id, require_tags FROM system_battle_boxes WHERE coupon_id=$1`, [id])).rows[0];
  if (!box) throw new AccountApiError(404, "qutu tapılmadı");
  const rows = (await pool.query(`SELECT seq, good_id, percent FROM system_battle_box_rewards WHERE coupon_id=$1 ORDER BY seq`, [id])).rows;
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.percent)), 0);
  const rewards = rows.map((row) => {
    const good = getGood(Number(row.good_id));
    const weight = Math.max(0, Number(row.percent));
    return { seq: Number(row.seq), good_id: Number(row.good_id), item_id: good?.item.id ?? 0, name: good?.item.name || `Good #${row.good_id}`, weight, chance: total > 0 ? weight * 100 / total : 0 };
  });
  return { body: { box: { coupon_id: Number(box.coupon_id), require_tags: Number(box.require_tags), rewards } } };
}

const csvInteger = (value: unknown, name: string): string => {
  const text = String(value ?? "").trim();
  if (!/^\d+(,\d+)*$/.test(text) || text.length > 255) throw new AccountApiError(400, `${name} vergüllə ayrılmış ədədlər olmalıdır`);
  return text;
};

async function updateShop(req: http.IncomingMessage, admin: AccountRow, id: string, raw: unknown): Promise<AdminResult> {
  if (!/^\d+$/.test(id)) throw new AccountApiError(400, "məhsul ID-si düzgün deyil");
  const input = objectBody(raw);
  const existing = (await pool.query(`SELECT price_cash_list, price_gold_list FROM system_shop WHERE item_id=$1`, [id])).rows[0];
  if (!existing) throw new AccountApiError(404, "məhsul tapılmadı");
  const proposedCash = String(input.price_cash_list ?? existing.price_cash_list ?? "0");
  const proposedGold = String(input.price_gold_list ?? existing.price_gold_list ?? "0");
  if ("duration_days" in input && ![...proposedCash.split(","), ...proposedGold.split(",")].some((x) => Number(x.trim()) > 1)) {
    throw new AccountApiError(400, "məhsulun satış qiyməti yoxdur; əvvəl Point və ya NG qiyməti yazın");
  }
  const values: unknown[] = [];
  const sets: string[] = [];
  const add = (column: string, value: unknown) => { values.push(value); sets.push(`${column}=$${values.length}`); };
  const shopDate = (d: Date) => Number(`${String(d.getFullYear() % 100).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`);
  if ("item_name" in input) {
    const name = String(input.item_name ?? "").trim();
    if (!name || name.length > 255) throw new AccountApiError(400, "məhsul adı düzgün deyil");
    add("item_name", name);
  }
  if ("item_visible" in input) {
    if (typeof input.item_visible !== "boolean") throw new AccountApiError(400, "görünürlük düzgün deyil");
    add("item_visible", input.item_visible);
  }
  if ("item_count_list" in input) add('"Item_count_list"', csvInteger(input.item_count_list, "say siyahısı"));
  if ("price_cash_list" in input) add("price_cash_list", csvInteger(input.price_cash_list, "NG qiymətləri"));
  if ("price_gold_list" in input) add("price_gold_list", csvInteger(input.price_gold_list, "Point qiymətləri"));
  if ("discount_percent" in input) add("discount_percent", integer(input.discount_percent, "endirim", 0, 100));
  if ("shop_tag" in input) add("shop_tag", integer(input.shop_tag, "etiket", 0, 255));
  if ("duration_days" in input) {
    const days = integer(input.duration_days, "satış müddəti", 0, 365);
    if (days === 0) { add("start_date", 0); add("end_date", 0); }
    else {
      const start = new Date(); start.setMinutes(start.getMinutes() - 2);
      const end = new Date(start); end.setDate(end.getDate() + days);
      add("start_date", shopDate(start)); add("end_date", shopDate(end));
    }
    if (!("item_visible" in input)) add("item_visible", true);
  }
  if ("start_date" in input) add("start_date", integer(input.start_date, "başlanğıc tarixi", 0, 9912312359));
  if ("end_date" in input) add("end_date", integer(input.end_date, "bitmə tarixi", 0, 9912312359));
  if ("start_date" in input && "end_date" in input && Number(input.end_date) > 0 && Number(input.end_date) <= Number(input.start_date)) {
    throw new AccountApiError(400, "bitmə tarixi başlanğıcdan sonra olmalıdır");
  }
  if (!sets.length) throw new AccountApiError(400, "dəyişiklik yoxdur");
  values.push(id);
  const result = await pool.query(
    `UPDATE system_shop SET ${sets.join(", ")} WHERE item_id=$${values.length}
     RETURNING item_id, item_name, item_consume, "Item_count_list" AS item_count_list, price_cash_list,
               price_gold_list, item_visible, discount_percent, shop_tag, start_date, end_date`, values,
  );
  if (!result.rows[0]) throw new AccountApiError(404, "məhsul tapılmadı");
  await audit(admin, req, "shop", `məhsul ${id} yeniləndi: ${sets.join(", ")}`);
  await loadShop();
  return { body: { item: result.rows[0] } };
}

export async function handleAdminApi(req: http.IncomingMessage, url: URL, body?: unknown): Promise<AdminResult> {
  const admin = await requireAdmin(req);
  if (req.method === "GET" && url.pathname === "/api/admin/me") {
    return { body: { playerId: String(admin.playerId), username: admin.username, nickname: admin.nickname, access: admin.access } };
  }
  if (req.method === "GET" && url.pathname === "/api/admin/users") return users(url);
  if (req.method === "GET" && url.pathname === "/api/admin/shop") return shopItems(url);
  const box = url.pathname.match(/^\/api\/admin\/boxes\/(28\d{5})$/);
  if (req.method === "GET" && box) return battleBoxDetails(box[1]);
  const user = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (req.method === "PATCH" && user) return updateUser(req, admin, user[1], body);
  const item = url.pathname.match(/^\/api\/admin\/shop\/(\d+)$/);
  if (req.method === "PATCH" && item) return updateShop(req, admin, item[1], body);
  throw new AccountApiError(404, "tapılmadı");
}
