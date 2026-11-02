import "./style.css";
import "./enhancements.css";
import { ItemPreview } from "../lobby/screens/preview3d.ts";

type User = { player_id: string; username: string; nickname: string; rank: number; experience: number; gold: number; cash: number; access_level: number; online: boolean; created_at: string };
type ShopItem = { item_id: number; item_name: string; item_consume: number; item_count_list: string; price_cash_list: string; price_gold_list: string; item_visible: boolean; discount_percent: number; shop_tag: number; start_date: number; end_date: number };

const API = `${location.protocol}//${location.hostname}:8090`;
const SESSION = "pb.admin.session";
let token = sessionStorage.getItem(SESSION) ?? "";
let tab: "users" | "shop" = "users";
let query = "";
let shopCategory = "all";
let shopLimit = 30;
let shopSupport = "all";
let shopVisibility = "all";
let timer = 0;
let supportedWeapons: Set<number> | null = null;
type IconRect = { sheet: string; x: number; y: number; w: number; h: number; atlas: string };
type IconIndex = { icons: Record<string, IconRect>; goods: Record<string, IconRect>; atlases: Record<string, { w: number; h: number }> };
let iconIndex: IconIndex | null = null;

const root = document.querySelector<HTMLDivElement>("#app")!;
const esc = (v: unknown) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  const body = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Sorğu uğursuz oldu (${res.status})`);
  return body as T;
}

function toast(message: string, bad = false): void {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div"); el.className = `toast${bad ? " bad" : ""}`; el.textContent = message;
  document.body.append(el); setTimeout(() => el.remove(), 3200);
}

function loginView(): void {
  root.innerHTML = `<main class="login-shell">
    <section class="login-art"><div class="brand"><span class="brand-mark">PB</span><span>EVOLVED</span></div><div><p class="eyebrow">KOMANDA MƏRKƏZİ</p><h1>Serveri bir<br><em>nöqtədən</em> idarə et.</h1><p class="lead">Hesablar, rütbələr, valyutalar və mağaza kataloqu üçün qorunan idarəetmə paneli.</p></div><p class="secure">● Lokal server bağlantısı</p></section>
    <section class="login-panel"><form id="login-form"><p class="eyebrow">GM GİRİŞİ</p><h2>İdarəetmə paneli</h2><p class="muted">Yalnız giriş səviyyəsi 100 olan hesablar.</p><label>İstifadəçi adı<input name="username" autocomplete="username" required maxlength="16" placeholder="GM hesabı"></label><label>Şifrə<input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="••••••••"></label><button class="primary" type="submit">Daxil ol <span>→</span></button><p id="login-error" class="form-error"></p></form></section>
  </main>`;
  document.querySelector<HTMLFormElement>("#login-form")!.addEventListener("submit", async (e) => {
    e.preventDefault(); const target = e.currentTarget as HTMLFormElement; const form = new FormData(target); const btn = target.querySelector<HTMLButtonElement>("button")!;
    btn.disabled = true; btn.textContent = "Yoxlanılır…";
    try {
      const result = await api<{ token: string }>("/api/login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      token = result.token; await api("/api/admin/me"); sessionStorage.setItem(SESSION, token); await dashboard();
    } catch (err) { token = ""; document.querySelector("#login-error")!.textContent = (err as Error).message; btn.disabled = false; btn.textContent = "Daxil ol →"; }
  });
}

async function dashboard(): Promise<void> {
  try {
    if (!supportedWeapons) {
      const support = await fetch("/assets/weapons/complete-cross.json").then(r => r.ok ? r.json() : null).catch(() => null) as { complete?: number[] } | null;
      if (Array.isArray(support?.complete)) supportedWeapons = new Set(support.complete);
    }
    if (!iconIndex) iconIndex = await fetch("/assets/ui/cross/icons/index.json").then(r => r.ok ? r.json() : null).catch(() => null) as IconIndex | null;
    const me = await api<{ username: string; nickname: string }>("/api/admin/me");
    root.innerHTML = `<div class="layout"><aside><div class="brand small"><span class="brand-mark">PB</span><span>EVOLVED</span></div><nav><button data-tab="users" class="active"><span>◉</span> İstifadəçilər</button><button data-tab="shop"><span>◇</span> Mağaza</button></nav><div class="aside-foot"><div class="avatar">${esc(me.nickname.slice(0, 1).toUpperCase())}</div><div><b>${esc(me.nickname)}</b><small>Game Master</small></div><button id="logout" title="Çıxış">↪</button></div></aside>
      <main class="content"><header><div><p class="eyebrow">EVOLVED PB / ADMIN</p><h1 id="page-title">İstifadəçilər</h1></div><div class="server"><i></i> Server aktivdir</div></header><section id="page"></section></main></div>`;
    document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.onclick = async () => { tab = b.dataset.tab as typeof tab; query = ""; shopCategory = "all"; document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === b)); await renderPage(); });
    document.querySelector<HTMLButtonElement>("#logout")!.onclick = () => { token = ""; sessionStorage.removeItem(SESSION); loginView(); };
    await renderPage();
  } catch { token = ""; sessionStorage.removeItem(SESSION); loginView(); }
}

async function renderPage(): Promise<void> {
  const page = document.querySelector<HTMLElement>("#page")!;
  document.querySelector("#page-title")!.textContent = tab === "users" ? "İstifadəçilər" : "Mağaza kataloqu";
  page.innerHTML = `<div class="toolbar"><div class="search">⌕ <input id="search" value="${esc(query)}" placeholder="${tab === "users" ? "Ad, ləqəb və ya ID ilə axtar" : "Silah adı və ya məhsul ID-si ilə axtar"}"></div><button class="refresh" id="refresh">↻ Yenilə</button></div><div class="panel loading">Məlumatlar yüklənir…</div>`;
  if (tab === "shop") {
    const cats = [["all","Hamısı"],["weapons","Silahlar"],["knives","Bıçaqlar"],["characters","Personajlar"],["masks","Maskalar"],["accessories","Aksesuarlar"],["boxes","Qutular"],["packages","Paketlər"],["special","Xüsusi"]];
    page.querySelector(".toolbar")!.insertAdjacentHTML("afterend", `<div class="category-bar">${cats.map(([v,n]) => `<button data-category="${v}" class="${shopCategory === v ? "active" : ""}">${n}</button>`).join("")}</div>`);
    page.querySelectorAll<HTMLButtonElement>("[data-category]").forEach(b => b.onclick = () => { shopCategory = b.dataset.category!; void renderPage(); });
    page.querySelector(".category-bar")!.insertAdjacentHTML("afterend", `<div class="catalog-filters"><label>Uyğunluq<select id="support-filter"><option value="all">Hamısı</option><option value="supported" ${shopSupport === "supported" ? "selected" : ""}>Dəstəklənir</option><option value="missing" ${shopSupport === "missing" ? "selected" : ""}>Asset yoxdur</option></select></label><label>Görünürlük<select id="visibility-filter"><option value="all">Hamısı</option><option value="active" ${shopVisibility === "active" ? "selected" : ""}>Aktiv</option><option value="hidden" ${shopVisibility === "hidden" ? "selected" : ""}>Gizli</option></select></label></div>`);
    page.querySelector<HTMLSelectElement>("#support-filter")!.value = shopSupport;
    page.querySelector<HTMLSelectElement>("#visibility-filter")!.value = shopVisibility;
    page.querySelector<HTMLSelectElement>("#support-filter")!.onchange = e => { shopSupport = (e.target as HTMLSelectElement).value; void renderPage(); };
    page.querySelector<HTMLSelectElement>("#visibility-filter")!.onchange = e => { shopVisibility = (e.target as HTMLSelectElement).value; void renderPage(); };
  }
  document.querySelector<HTMLInputElement>("#search")!.oninput = (e) => { query = (e.target as HTMLInputElement).value; clearTimeout(timer); timer = window.setTimeout(renderPage, 280); };
  document.querySelector<HTMLButtonElement>("#refresh")!.onclick = () => renderPage();
  try { if (tab === "users") await renderUsers(page); else await renderShop(page); }
  catch (err) { page.querySelector(".panel")!.innerHTML = `<div class="empty">${esc((err as Error).message)}</div>`; }
}

async function renderUsers(page: HTMLElement): Promise<void> {
  const data = await api<{ total: number; users: User[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`);
  page.querySelector(".panel")!.className = "panel";
  page.querySelector(".panel")!.innerHTML = `<div class="panel-head"><div><b>${data.total.toLocaleString("az-AZ")}</b><span> qeydiyyatlı hesab</span></div><span>Redaktə üçün sətrə kliklə</span></div><div class="table-wrap"><table><thead><tr><th>İSTİFADƏÇİ</th><th>RÜTBƏ</th><th>POINT</th><th>NG</th><th>SƏLAHİYYƏT</th><th>STATUS</th><th></th></tr></thead><tbody>${data.users.map(u => `<tr data-id="${u.player_id}"><td><div class="user-cell"><span class="mini-avatar">${esc(u.nickname[0]?.toUpperCase() || "?")}</span><div><b>${esc(u.nickname)}</b><small>@${esc(u.username)} · #${u.player_id}</small></div></div></td><td>${u.rank}</td><td>${u.gold.toLocaleString("az-AZ")}</td><td>${u.cash.toLocaleString("az-AZ")}</td><td><span class="role ${u.access_level >= 100 ? "gm" : u.access_level < 0 ? "ban" : ""}">${u.access_level >= 100 ? "GM" : u.access_level < 0 ? "BAN" : "OYUNÇU"}</span></td><td><span class="status ${u.online ? "on" : ""}">${u.online ? "Onlayn" : "Oflayn"}</span></td><td>›</td></tr>`).join("")}</tbody></table></div>`;
  page.querySelectorAll<HTMLTableRowElement>("tr[data-id]").forEach((tr) => tr.onclick = () => editUser(data.users.find(u => u.player_id === tr.dataset.id)!));
}

async function renderShop(page: HTMLElement): Promise<void> {
  const searching = query.trim().length > 0;
  const data = await api<{ total: number; items: ShopItem[] }>(`/api/admin/shop?q=${encodeURIComponent(query)}&category=${encodeURIComponent(shopCategory)}&support=${encodeURIComponent(shopSupport)}&visibility=${encodeURIComponent(shopVisibility)}&limit=${shopLimit}`);
  page.querySelector(".panel")!.className = "panel";
  const limitOptions = [[30,"30"],[100,"100"],[500,"500"],[1000,"1000"],[5000,"Hamısı"]] as const;
  page.querySelector(".panel")!.innerHTML = `<div class="panel-head"><div><b>${data.total.toLocaleString("az-AZ")}</b><span> mağaza məhsulu</span></div><label class="result-limit">Göstərilən nəticə<select id="shop-limit">${limitOptions.map(([v,n]) => `<option value="${v}" ${shopLimit === v ? "selected" : ""}>${n}</option>`).join("")}</select><span>${data.items.length.toLocaleString("az-AZ")} / ${data.total.toLocaleString("az-AZ")}</span></label></div><div class="table-wrap"><table><thead><tr><th>MƏHSUL</th><th>SAY / MÜDDƏT</th><th>POINT</th><th>NG</th><th>ENDİRİM</th><th>UYĞUNLUQ</th><th>GÖRÜNÜRLÜK</th><th></th></tr></thead><tbody>${data.items.map(i => { const weapon = i.item_id >= 100000 && i.item_id < 1700000; const ok = !weapon || !supportedWeapons || supportedWeapons.has(i.item_id); return `<tr data-id="${i.item_id}"><td><div class="item-cell">${iconHtml(i.item_id)}<div><b>${esc(i.item_name)}</b><small>#${i.item_id}</small></div></div></td><td>${esc(i.item_count_list)}</td><td>${esc(i.price_gold_list)}</td><td>${esc(i.price_cash_list)}</td><td>${i.discount_percent}%</td><td><span class="status ${ok ? "on" : ""}">${ok ? "Dəstəklənir" : "Asset yoxdur"}</span></td><td><span class="status ${i.item_visible ? "on" : ""}">${i.item_visible ? "Aktiv" : "Gizli"}</span></td><td>›</td></tr>`; }).join("")}</tbody></table></div>`;
  page.querySelector<HTMLSelectElement>("#shop-limit")!.onchange = (e) => { shopLimit = Number((e.target as HTMLSelectElement).value); void renderPage(); };
  page.querySelectorAll<HTMLTableRowElement>("tr[data-id]").forEach((tr) => tr.onclick = () => void editShop(data.items.find(i => String(i.item_id) === tr.dataset.id)!));
}

function iconRect(itemId: number): IconRect | null {
  if (!iconIndex) return null;
  return iconIndex.icons[itemId] ?? iconIndex.goods[itemId] ?? (Math.floor(itemId / 100000) === 17 ? iconIndex.icons[1600000 + itemId % 1000] : null) ?? null;
}
function iconHtml(itemId: number, large = false): string {
  const r = iconRect(itemId), boxW = large ? 300 : 58, boxH = large ? 110 : 38;
  if (!r) return `<span class="item-icon ${large ? "large" : ""}">◆</span>`;
  const a = iconIndex!.atlases[r.atlas], scale = Math.min(boxW / r.w, boxH / r.h);
  return `<span class="item-icon real ${large ? "large" : ""}"><i style="width:${r.w*scale}px;height:${r.h*scale}px;background-image:url('/assets/ui/${esc(r.sheet)}');background-size:${a.w*scale}px ${a.h*scale}px;background-position:${-r.x*scale}px ${-r.y*scale}px"></i></span>`;
}

function modal(title: string, subtitle: string, fields: string, onSave: (form: FormData) => Promise<void>): HTMLElement {
  const wrap = document.createElement("div"); wrap.className = "modal-wrap"; wrap.innerHTML = `<div class="modal"><button class="modal-x">×</button><p class="eyebrow">REDAKTƏ</p><h2>${esc(title)}</h2><p class="muted">${esc(subtitle)}</p><form>${fields}<div class="modal-actions"><button type="button" class="ghost">Ləğv et</button><button type="submit" class="primary">Yadda saxla</button></div><p class="form-error"></p></form></div>`;
  document.body.append(wrap); const close = () => { wrap.dispatchEvent(new Event("modalclose")); wrap.remove(); }; wrap.querySelector<HTMLButtonElement>(".modal-x")!.onclick = close; wrap.querySelector<HTMLButtonElement>(".ghost")!.onclick = close; wrap.onclick = e => { if (e.target === wrap) close(); };
  wrap.querySelector<HTMLFormElement>("form")!.onsubmit = async e => { e.preventDefault(); const target = e.currentTarget as HTMLFormElement; const btn = target.querySelector<HTMLButtonElement>("button[type=submit]")!; btn.disabled = true; btn.textContent = "Saxlanılır…"; try { await onSave(new FormData(target)); close(); toast("Dəyişikliklər yadda saxlanıldı"); await renderPage(); } catch (err) { target.querySelector(".form-error")!.textContent = (err as Error).message; btn.disabled = false; btn.textContent = "Yadda saxla"; } };
  return wrap;
}

const field = (label: string, name: string, value: unknown, type = "text", required = true) => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
function editUser(u: User): void {
  modal(u.nickname, `@${u.username} · Oyunçu ID: ${u.player_id}`, `<div class="form-grid">${field("Ləqəb", "nickname", u.nickname)}${field("Rütbə", "rank", u.rank, "number")}${field("Təcrübə", "experience", u.experience, "number")}${field("Point", "gold", u.gold, "number")}${field("NG", "cash", u.cash, "number")}<label>Giriş səviyyəsi<select name="access_level"><option value="0" ${u.access_level === 0 ? "selected" : ""}>0 — Oyunçu</option><option value="50" ${u.access_level === 50 ? "selected" : ""}>50 — Moderator</option><option value="100" ${u.access_level === 100 ? "selected" : ""}>100 — Game Master</option><option value="-1" ${u.access_level < 0 ? "selected" : ""}>-1 — Bloklanıb</option></select></label></div>`, async f => api(`/api/admin/users/${u.player_id}`, { method: "PATCH", body: JSON.stringify({ nickname: f.get("nickname"), rank: Number(f.get("rank")), experience: Number(f.get("experience")), gold: Number(f.get("gold")), cash: Number(f.get("cash")), access_level: Number(f.get("access_level")) }) }));
}
async function editShop(i: ShopItem): Promise<void> {
  const fromShopDate = (v: number) => { const s = String(v || ""); return s.length === 10 ? `20${s.slice(0,2)}-${s.slice(2,4)}-${s.slice(4,6)}T${s.slice(6,8)}:${s.slice(8,10)}` : ""; };
  const toShopDate = (v: FormDataEntryValue | null) => { const s = String(v ?? "").replace(/\D/g, ""); return s.length >= 12 ? Number(s.slice(2,12)) : 0; };
  const dateToShopDate = (d: Date) => Number(`${String(d.getFullYear() % 100).padStart(2,"0")}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`);
  const tags = [[0,"Normal"],[1,"Yeni"],[2,"Hot"],[3,"Event"],[5,"Endirim"]] as const;
  const supported = !supportedWeapons || supportedWeapons.has(i.item_id);
  const campaigns = `<label>Kampaniya<select name="campaign"><option value="manual">Əl ilə idarə et</option><option value="flash">⚡ Flash Sale — 24 saat</option><option value="daily">☀ Günlük təklif — günün sonunadək</option><option value="weekend">★ Həftəsonu endirimi</option><option value="new7">YENİ — 7 gün</option></select></label>`;
  const simple = `<div class="catalog-id"><span>Məhsul ID</span><b>${i.item_id}</b><button type="button" data-copy="${i.item_id}">ID-ni köçür</button></div><div class="admin-preview"><div class="preview-icon">${iconHtml(i.item_id, true)}</div><div class="model-preview"><span>3D model yüklənir…</span></div></div><div class="form-grid">${field("Oyunda görünən silah/məhsul adı", "item_name", i.item_name)}${campaigns}<label>Nişan<select name="shop_tag">${tags.map(([v,n]) => `<option value="${v}" ${i.shop_tag === v ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>Satış müddəti<select name="duration"><option value="0" ${!i.end_date ? "selected" : ""}>Daimi</option><option value="1">1 gün</option><option value="3">3 gün</option><option value="7" ${i.end_date ? "selected" : ""}>7 gün</option><option value="30">30 gün</option><option value="custom">Əl ilə tarix</option></select></label>${field("Endirim (%)", "discount_percent", i.discount_percent, "number")}<label class="check"><input name="item_visible" type="checkbox" ${i.item_visible ? "checked" : ""}> Satışda aktiv olsun</label></div>`;
  const advanced = `<details><summary>Ətraflı qiymət və tarix ayarları</summary><div class="form-grid">${field("Say / müddət siyahısı", "item_count_list", i.item_count_list)}${field("Point qiymətləri", "price_gold_list", i.price_gold_list)}${field("NG qiymətləri", "price_cash_list", i.price_cash_list)}${field("Başlanğıc (istəyə bağlı)", "start_date", fromShopDate(i.start_date), "datetime-local", false)}${field("Bitmə (istəyə bağlı)", "end_date", fromShopDate(i.end_date), "datetime-local", false)}</div></details>`;
  let boxPanel = "";
  if (Math.floor(i.item_id / 100000) === 28) {
    try {
      const data = await api<{ box: { rewards: { good_id: number; item_id: number; name: string; chance: number }[] } }>(`/api/admin/boxes/${i.item_id}`);
      boxPanel = `<details open class="box-rewards"><summary>Qutunun içindəkilər (${data.box.rewards.length})</summary><div class="reward-list">${data.box.rewards.map(r => `<div>${r.item_id ? iconHtml(r.item_id) : ""}<span><b>${esc(r.name)}</b><small>#${r.good_id}${r.item_id ? ` · Əşya #${r.item_id}` : ""}</small></span><strong>${r.chance.toFixed(2)}%</strong></div>`).join("")}</div></details>`;
    } catch (e) { boxPanel = `<p class="form-error">Qutu məzmunu yüklənmədi: ${esc((e as Error).message)}</p>`; }
  }
  const wrap = modal(i.item_name, "Kataloq məhsulunu idarə et", `${supported ? "" : `<p class="form-error">Bu məhsulun web assetləri yoxdur və oyunda gizlənəcək.</p>`}${simple}${boxPanel}${advanced}<p class="event-note">Kampaniya presetləri nişanı, endirimi və tarixləri avtomatik qurur. Vaxt çatanda mağaza özü aktivləşir və bitəndə məhsulu avtomatik gizlədir.</p>`, async f => {
    const duration = String(f.get("duration"));
    let start = 0, end = 0;
    if (duration === "custom") { start = toShopDate(f.get("start_date")); end = toShopDate(f.get("end_date")); }
    let tag = Number(f.get("shop_tag")), discount = Number(f.get("discount_percent")), visible = f.get("item_visible") === "on";
    const campaign = String(f.get("campaign"));
    if (campaign !== "manual") {
      const a = new Date(), b = new Date(a); visible = true;
      if (campaign === "flash") { b.setHours(b.getHours() + 24); tag = 5; discount = Math.max(20, discount); }
      if (campaign === "daily") { b.setHours(23, 59, 0, 0); tag = 2; }
      if (campaign === "new7") { b.setDate(b.getDate() + 7); tag = 1; }
      if (campaign === "weekend") {
        const day = a.getDay(), untilFriday = (5 - day + 7) % 7;
        if (day !== 5 && day !== 6 && day !== 0) { a.setDate(a.getDate() + untilFriday); a.setHours(18, 0, 0, 0); }
        b.setTime(a.getTime()); b.setDate(b.getDate() + (b.getDay() === 0 ? 0 : 7 - b.getDay())); b.setHours(23, 59, 0, 0);
        tag = 5; discount = Math.max(15, discount);
      }
      start = dateToShopDate(a); end = dateToShopDate(b);
    }
    return api(`/api/admin/shop/${i.item_id}`, { method: "PATCH", body: JSON.stringify({ item_name: f.get("item_name"), item_count_list: f.get("item_count_list"), price_gold_list: f.get("price_gold_list"), price_cash_list: f.get("price_cash_list"), discount_percent: discount, shop_tag: tag, item_visible: visible, ...(campaign !== "manual" ? { start_date: start, end_date: end } : duration === "custom" ? { start_date: start, end_date: end } : { duration_days: Number(duration) }) }) });
  });
  const itemClass = Math.floor(i.item_id / 100000);
  if (itemClass >= 1 && itemClass <= 6) {
    const holder = wrap.querySelector<HTMLElement>(".model-preview")!;
    const preview = new ItemPreview(300, 150);
    holder.textContent = ""; holder.append(preview.el);
    void preview.show(i.item_id, itemClass === 6).catch(() => {});
    wrap.addEventListener("modalclose", () => preview.dispose(), { once: true });
  } else wrap.querySelector<HTMLElement>(".model-preview")!.innerHTML = "<span>Bu məhsul üçün 3D model yoxdur</span>";
  const copy = document.querySelector<HTMLButtonElement>(`[data-copy="${i.item_id}"]`);
  if (copy) copy.onclick = () => { void navigator.clipboard.writeText(String(i.item_id)); toast("Məhsul ID-si köçürüldü"); };
}

if (token) void dashboard(); else loginView();
