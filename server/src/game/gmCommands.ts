// GM chat commands: Server.Game CommandManager (":name args" in lobby/room chat, 2384 types All/Lobby) with the ten
// ICommand classes of Data/Commands and PermissionXML (system_permissions + system_access_rights, keyed by Account.Access).
// The reply is PROTOCOL_LOBBY_CHATTING_ACK(0, 5, false, result); an exception answers CommandsExceptionError.
import { PacketWriter } from "../../../src/net/packet.ts";
import { pool } from "../db.ts";
import type { Account } from "../shared/account.ts";
import * as dao from "../shared/dao.ts";
import { loadBattlePass } from "../shared/data.ts";
import { ItemsModel, ItemCategory, ItemEquipType, getItemCategory } from "../shared/items.ts";
import { getGood, getGoodByItemId, loadShop } from "../shared/shop.ts";
import { getLabel } from "../shared/translation.ts";
import { pointCashAck } from "../auth/packets.ts";
import { seasonChallengeInfoAck } from "../auth/metaPackets.ts";
import * as gp from "./packets.ts";
import { grantItem } from "./progress.ts";
import { tryCreateItem } from "../shared/playerUtils.ts";
import { titlesTable } from "./profileHandlers.ts";
import { roomOf, endBattleByCommand } from "./roomHandlers.ts";
import { lobbyChatAck } from "./socialHandlers.ts";
import { PLAYER_HELP, tokenize } from "./chatGuard.ts";
import { applyMute, reportsSummary } from "./reports.ts";
import { bugsSummary } from "./bugReports.ts";
import { SlotState } from "./roomModel.ts";
import type { GameClient } from "./gameServer.ts";

const log = (m: string) => console.log(`${new Date().toISOString()} [gm-ts] ${m}`);
const send = (a: Account | null | undefined, b: Uint8Array) => (a?.connection as GameClient | null)?.session.send(b);

/** quoted[i]: args[i] was written "in quotes" (only filled for :player, see serverCommands) */
interface Command { command: string; description: string; permission: string; args: string; execute(args: string[], p: Account, quoted: boolean[]): Promise<string> | string }

/** Wired by gameServer.ts. */
export const gm = {
  online: (): Iterable<Account> => [],
  byPid: async (_p: bigint): Promise<Account | null> => null,
  byNick: async (_n: string): Promise<Account | null> => null,
  /** accounts.access_level now (null = no row); replaced by the unit tests */
  accessOf: async (pid: bigint): Promise<number | null> => {
    const x = (await pool.query(`SELECT access_level FROM accounts WHERE player_id=$1`, [String(pid)])).rows[0];
    return x ? Number(x.access_level) : null;
  },
};

// ---- PermissionXML -----------------------------------------------------------------------------------------------------
let rights = new Map<number, Set<string>>();
export async function loadPermissions(): Promise<void> {
  const names = new Map((await pool.query(`SELECT key, name FROM system_permissions ORDER BY key ASC`)).rows.map((x) => [Number(x.key), String(x.name)]));
  rights = new Map();
  for (const x of (await pool.query(`SELECT key FROM system_access_levels ORDER BY key ASC`)).rows) rights.set(Number(x.key), new Set());
  for (const x of (await pool.query(`SELECT level_key, permission_key FROM system_access_rights ORDER BY level_key ASC, permission_key ASC`)).rows) {
    const lv = Number(x.level_key);
    if (!rights.has(lv)) rights.set(lv, new Set());
    const n = names.get(Number(x.permission_key));
    if (n) rights.get(lv)!.add(n);
  }
  log(`${names.size} permissions, ${rights.size} levels`);
}
const havePermission = (p: Account, perm: string) => rights.get(p.access)?.has(perm) ?? false;

// ---- helpers -----------------------------------------------------------------------------------------------------------
/** ComDiv.ToTitleCase: title-cases the first word only. */
const titleCase = (t: string) => { const w = t.split(" ")[0].toLowerCase(), tc = w.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()); return t.replace(t.split(" ")[0], tc); };
/** int.Parse (throws like C# on bad input -> CommandsExceptionError). */
const parseInt32 = (s: string | undefined) => { const t = (s ?? "").trim(); if (!/^[+-]?\d+$/.test(t)) throw new Error(`FormatException: ${s}`); const n = Number(t); if (n > 2147483647 || n < -2147483648) throw new Error("OverflowException"); return n; };
const tryInt = (s: string | undefined) => (/^\s*[+-]?\d+\s*$/.test(s ?? "") && Math.abs(Number(s)) <= 2147483647 ? Number(s) : null);
const tryLong = (s: string | undefined) => (/^\s*[+-]?\d+\s*$/.test(s ?? "") ? BigInt(String(s).trim()) : null);
const lower = (s: string | undefined) => { if (s === undefined) throw new Error("IndexOutOfRangeException"); return s.toLowerCase(); };
const closeAccount = (a: Account, ms: number) => (a.connection as GameClient | null)?.session.close(true, ms);
const kickAck = () => new PacketWriter(24).writeH(2009).zeros(19).writeC(0).toBytes();
const rewardPopupAck = (target: Account, item: ItemsModel) => new PacketWriter(16).writeH(2430).writeH(0).writeH(target.inventory.items.length).writeC(1).writeD(item.id).toBytes();
/** the web client draws no announce popup (3079), so GM notices go as "Server" chat lines, one per line of text */
const toChat = (a: Account, text: string) => { for (const l of text.split(/\r?\n/)) if (l.trim()) send(a, lobbyChatAck(0, "Server", 5, false, l.trim().slice(0, 240))); };
const toAllChat = (text: string) => { for (const a of gm.online()) toChat(a, text); };

const WEAPONS = { AllWeapons: 511, AssaultRifle: 31, SubMachineGun: 47, SniperRifle: 79, ShotGun: 143, MachineGun: 271, RPG7: 511 }; // Data/CommandHelper.JSON "WeaponsFlag"
const PLAYTIME: Record<number, number> = { 5: 85, 10: 101, 15: 117, 20: 133, 25: 149, 30: 165 }; // "PlayTime" MinutesNN
const sys = { udpType: 3, debug: false, test: false, debugPing: false }; // ConfigLoader runtime toggles (no effect on the TS servers)
const UDP_NAMES = ["NONE", "RELAY", "RELAY_P2P", "RELAY", "CLIENT"];

/** Sets every title flag on `p` (online or loaded from the DB), saves it and, when connected, sends the 2383 titles packet. Returns how many were new. */
async function unlockAllTitles(p: Account): Promise<number> {
  const t = p.title;
  let n = 0;
  for (let id = 1; id <= 44; id++) {
    const m = titlesTable().get(id);
    if (m && (t.flags & m.flag) !== m.flag) { n++; t.flags |= m.flag; if (t.slots < m.slot) t.slots = m.slot; }
  }
  if (n > 0) {
    await dao.update1("player_titles", "slots", t.slots, "owner_id", p.playerId);
    await dao.update1("player_titles", "flags", t.flags.toString(), "owner_id", p.playerId);
    const w = new PacketWriter(32).writeH(2383).writeD(Number(p.playerId & 0xffffffffn)).writeQ(t.flags).writeC(t.equiped1).writeC(t.equiped2).writeC(t.equiped3).writeD(t.slots);
    send(p, w.toBytes());
  }
  return n;
}

/** :player title <nick|uid>: unlockAllTitles for another player; offline targets are saved and apply at the next login. */
async function executeTitle(target: string | undefined, isNick: boolean, p: Account): Promise<string> {
  if (!target) return "İstifadə: player title <nick|uid> (boşluqlu və ya rəqəmli niklər üçün \"dırnaq\")";
  const uid = isNick ? null : tryLong(target);
  const label = uid !== null ? `UID: ${uid}` : `Nick: ${target}`;
  const t = uid !== null ? await gm.byPid(uid) : await gm.byNick(target);
  if (!t) return `${label} olan oyunçu tapılmadı!`;
  if (t.playerId !== p.playerId && t.access > p.access) return `Titul uğursuz oldu! (Sizdən yüksək səviyyəli oyunçuya tətbiq edə bilməzsiniz)`;
  const n = await unlockAllTitles(t);
  const online = !!t.connection;
  if (n > 0 && online) toChat(t, `Bütün titullar ${p.nickname} tərəfindən açıldı.`);
  return `UID: ${t.playerId} (${t.nickname}) üçün bütün titullar açıldı - ${n} yeni${online ? "" : " (oflayn, növbəti girişdə tətbiq olunacaq)"}`;
}

/** ValuesCommand.ResolveItem: GoodsId, then ItemId, then a raw item id (>= 100000). */
function resolveItem(v: number): ItemsModel | null {
  const g = getGood(v) ?? getGoodByItemId(v);
  if (g) return g.item.clone();
  if (v < 100000) return null;
  return new ItemsModel(v, "Command Item", getItemCategory(v) === ItemCategory.Coupon ? ItemEquipType.Durable : ItemEquipType.Permanent, 1);
}
async function grantWithPopup(target: Account, item: ItemsModel): Promise<void> { send(target, rewardPopupAck(target, item)); await grantItem(target, item); }

async function saveBan(a: Account, days: number): Promise<bigint | null> {
  try {
    const r = await pool.query(`INSERT INTO base_ban_history(owner_id, player_id, type, value, reason, start_date, expire_date) VALUES($1, $1, 'ACCOUNT', $2, 'GM Command', $3, $4) RETURNING object_id`,
      [String(a.playerId), String(a.playerId), new Date(), new Date(Date.now() + days * 86400000)]);
    return BigInt(r.rows[0].object_id);
  } catch (e) { log(`SaveBanHistory: ${e}`); return null; }
}

/** `:help <command>` detail: syntax lines and examples per command [RECRIADO: the C# help only printed the one-line args] */
const HELP_DETAIL: Record<string, string[]> = {
  help: [":help [səhifə] - istifadə edə biləcəyiniz əmrləri siyahılayır (hər səhifədə 5)", ":help <əmr> - bir əmrin sintaksisi və nümunələri"],
  endbattle: [":endbattle - otağınızdakı davam edən döyüşü bitirir (başlamış matçda olmalısınız)"],
  host: [
    ":host wpn <all|ar|smg|sr|sg|mg|rpg> - otaq silahlarını məhdudlaşdırır (otaq lideri, otaqda)",
    ":host time <dəqiqə> - otaq oyun müddəti (3, 5, 7, 10, 15, 20, 25, 30)",
    ":host compe <on|off> - yarışma rejimi (otaqda 3v3, 4v4 və ya 5v5 slot olmalıdır)",
    "məs. :host wpn sr",
  ],
  sendmsg: [
    ":sendmsg room <mətn> - otağınızdakı hər kəsə mesaj",
    ":sendmsg channel <mətn> - kanalınızın lobbisinə mesaj",
    ":sendmsg player <mətn> - bütün onlayn oyunçulara mesaj",
    "məs. :sendmsg player Server 5 dəqiqəyə yenidən başlayacaq",
  ],
  roominfo: [
    ":roominfo time <n> - otaq vaxtı (matç başlamazdan əvvəl)",
    ":roominfo flags <n> - silah bayrağı (rəqəm)",
    ":roominfo killcam <0-255> - öldürmə kamerası dəyəri",
  ],
  sys: [
    ":sys udp <1-4> - UDP rejimi",
    ":sys debug <0|1> | :sys test <0|1> | :sys ping <0|1> - debug / test / ping rejimləri",
    ":sys reload <pase|classic_mode> - battle pass / klassik rejimi yenidən yüklə",
    ":sys title all - bütün titulları özünüz üçün aç",
  ],
  teamcash: [":teamcash <red|blue> <cash> - otağınızdakı komandanın hər oyunçusuna cash verir", "məs. :teamcash red 1000"],
  title: [":title - bütün titulları özünüz üçün aç"],
  reports: [":reports - son oyunçu şikayətləri", ":reports <nick> - bir nickə aid şikayətlər (boşluqlu niklər üçün \"dırnaq\")"],
  mute: [":mute <nick> <dəqiqə> - oyunçunu çatda susdurur (1-43200); 0 susdurmağı qaldırır", "məs. :mute teste3 30"],
  bugs: [":bugs [n] - son xəta hesabatları (n 1-20, standart 5)"],
  refreshshop: [":refreshshop - mağaza kataloqunu yenidən yükləyir və sizə göndərir"],
  player: [
    ":player gift <gold|cash|tags> <miqdar> <uid|nick> - valyuta ver (məs. :player gift gold 5000 teste3)",
    ":player gift item <goodsId> <uid|nick> - əşya ver",
    ":player kick <nick|uid> [saniyə] - onlayn oyunçunu çıxar (məs. :player kick teste3)",
    ":player ban normal <gün> <uid|nick> - N günlük ban",
    ":player ban permanent <gün> <uid|nick> - daimi ban (gün nəzərə alınmır, istənilən rəqəm)",
    ":player title <nick|uid> - başqa oyunçunun bütün titullarını aç (onlayn və ya oflayn; məs. :player title teste3)",
    ":player xtx ci <goodsId|itemId> - özünüzə əşya ver; :player xtx cia <id> <uid|nick> - başqa oyunçuya əşya ver",
  ],
};

// ---- the commands (Data/Commands, assembly order) ----------------------------------------------------------------------
const COMMANDS: Command[] = [
  {
    command: "endbattle", description: "Davam edən döyüşü bitir", permission: "moderatorcommand", args: "",
    execute(_a, p) {
      const r = roomOf(p);
      if (!r) return "Bu əmri icra etmək üçün otaqda olmalısınız.";
      const s = r.getSlot(p.slotId);
      if (!r.isPreparing() || !(s && s.state >= SlotState.READY)) return "Xəta! Döyüş hələ başlamamışdır.";
      endBattleByCommand(r);
      return "Döyüş bitirildi.";
    },
  },
  {
    command: "help", description: "Mövcud əmrləri göstər", permission: "helpcommand", args: "%səhifə% (istəyə bağlı)",
    execute(a, p) {
      // one chat line per command: the web client does not draw the announce popup the C# server used here
      const line = (t: string) => send(p, lobbyChatAck(0, "Server", 5, false, t));
      const mine = COMMANDS.filter((c) => havePermission(p, c.permission));
      if (a.length !== 0 && tryInt(a[0]) === null) {
        const name = lower(a[0]).replace(/^:/, "");
        const c = mine.find((x) => x.command === name);
        if (!c) return `'${name}' əmri tapılmadı. Əmrləri görmək üçün :help yazın.`;
        line(`:${c.command} - ${c.description}`);
        for (const l of HELP_DETAIL[c.command] ?? [`:${c.command} ${c.args}`]) line(l);
        return `'${c.command}' əmrinin yardımı göstərildi`;
      }
      let page = 1;
      if (a.length !== 0) { const n = tryInt(a[0]); page = n === null ? 1 : n === 0 ? 1 : n; }
      const pages = Math.trunc((mine.length + 5 - 1) / 5);
      if (page < 1 || page > pages) return `Zəhmət olmasa düzgün səhifə daxil edin. Səhifələr: ${pages}`;
      const chunk = mine.slice((page - 1) * 5, page * 5);
      line(`Əmrlər (${page}/${pages}) - ":help <əmr>" sintaksis və nümunələri göstərir:`);
      for (const c of chunk) line(`:${c.command} ${c.args} -> ${c.description}`);
      if (page === pages) { line("Oyunçu əmrləri (hamısı), çatda yazın:"); for (const l of PLAYER_HELP) line(l); }
      return `Əmrlər səhifəsi '${page}' / '${pages}' göstərildi`;
    },
  },
  {
    command: "host", description: "Otaq parametrlərini dəyişdir (Yalnız Lider)", permission: "hostcommand", args: "%seçim% %dəyər%",
    execute(a, p) {
      const r = roomOf(p);
      if (!r) return "Bu əmri icra etmək üçün otaqda olmalısınız.";
      if (r.leader !== p.slotId || r.slots[r.leader]?.playerId !== p.playerId) return "Bu əmr yalnız otaq lideri (Host) üçün keçərlidir.";
      const opt = lower(a[0]), val = lower(a[1]);
      switch (opt) {
        case "wpn": {
          const set = (f: number, msg: string) => { r.weaponsFlag = f; r.updateRoomInfo(); return msg; };
          switch (val) {
            case "all": return set(WEAPONS.AllWeapons, "Bütün Silahlar (AR, SMG, SR, SG, MG, SHD)");
            case "sg": return set(WEAPONS.ShotGun, "Yalnız Ov Tüfəngi (SG)");
            case "sr": return set(WEAPONS.SniperRifle, "Yalnız Snayper Tüfəngi (SR)");
            case "rpg": return set(WEAPONS.RPG7, "Yalnız RPG-7");
            case "ar": return set(WEAPONS.AssaultRifle, "Yalnız Hücum Tüfəngi (AR)");
            case "mg": return set(WEAPONS.MachineGun, "Yalnız Pulemyot (MG)");
            case "smg": return set(WEAPONS.SubMachineGun, "Yalnız Avtomat (SMG)");
          }
          return set(WEAPONS.AllWeapons, "Standart Silah (Dəyər tapılmadı)");
        }
        case "time": {
          const m = parseInt32(val);
          if (PLAYTIME[m] !== undefined) { r.killTime = PLAYTIME[m]; r.updateRoomInfo(); return `${titleCase(opt)} ${m} Dəqiqə`; }
          return `${titleCase(opt)} Yoxdur! (Yanlış Dəyər)`;
        }
        case "compe":
          switch (val) {
            case "on": {
              const n = r.getSlotCount();
              if (n !== 6 && n !== 8 && n !== 10) return "Zəhmət olmasa slotları (3v3) və ya (4v4) və ya (5v5) olaraq dəyişdirin";
              r.name = "Competitive!!!"; r.competitive = true;
              // AllUtils.SendCompetitiveInfo: the competitive rank table (Competitive.Rank()) is not ported, points only
              send(p, lobbyChatAck(p.session?.sessionId ?? 0, getLabel("Competitive"), p.nickColor, true, getLabel("CompetitiveRank", "-", p.competitive.points, 0)));
              return `${titleCase(opt)}titive Aktivləşdirildi!`;
            }
            case "off":
              r.name = ["Feel the Headshots!!", "Land of Dead!", "Kill! or be Killed!!"][Math.floor(Math.random() * 3)];
              r.competitive = false;
              return `${titleCase(opt)}titive Söndürüldü!`;
            default: return `Yarışma əmrini istifadə etmək mümkün deyil! (Yanlış Dəyər: ${val})`;
          }
        default: return `${titleCase(opt)} əmri tapılmadı!`;
      }
    },
  },
  {
    command: "sendmsg", description: "Mesaj göndər", permission: "moderatorcommand", args: "%seçim% %mətn%",
    execute(a, p) {
      const opt = lower(a[0]), text = a.slice(1).join(" ");
      switch (opt) {
        case "room": {
          const r = roomOf(p);
          if (!r) return "Bu əmri icra etmək üçün otaqda olmalısınız.";
          for (const x of r.getAllPlayers()) toChat(x, text);
          return `Mesaj cari Otaq Id: ${r.roomId + 1} göndərildi`;
        }
        case "channel": {
          const ch = (p.connection as GameClient | null)?.channelOf(p) ?? null;
          if (!ch) return "Zəhmət olmasa əmri lobbidə icra edin.";
          for (const x of ch.lobbyPlayers) toChat(x, text);
          return `Mesaj cari Kanal Id: ${ch.id + 1} göndərildi`;
        }
        case "player": {
          let n = 0;
          for (const x of gm.online()) { toChat(x, text); n++; }
          return `Mesaj ${n} oyunçuya göndərildi`;
        }
        default: return `${titleCase(opt)} əmri tapılmadı!`;
      }
    },
  },
  {
    command: "roominfo", description: "Otaq parametrlərini dəyişdir", permission: "moderatorcommand", args: "%seçim% %dəyər%",
    execute(a, p) {
      const r = roomOf(p);
      if (!r) return "Bu əmri icra etmək üçün otaqda olmalısınız.";
      const opt = lower(a[0]), val = lower(a[1]);
      switch (opt) {
        case "time": {
          const n = parseInt32(val) * 6;
          if (n < 0) return `Xəta! Xəritə 'indeksi' ${val} olmamalıdır. Daha yüksək dəyər yoxlayın.`;
          const s = r.getSlot(p.slotId);
          if (r.isPreparing() || (s && s.state >= SlotState.READY)) return "Xəta! Matç başladıqdan sonra 'vaxtı' dəyişmək olmaz.";
          r.killTime = n; r.updateRoomInfo();
          return `${titleCase(opt)} ${[3, 3, 3, 5, 7, 5, 10, 15, 20, 25, 30][r.killTime >> 4] % 60} Dəqiqəyə dəyişdirildi`; // TIMES[KillTime >> 4] (throws past the table, like C#)
        }
        case "flags": { const f = parseInt32(val); r.weaponsFlag = f; r.updateRoomInfo(); return `${titleCase(opt)} ${f} olaraq dəyişdirildi`; }
        case "killcam": { const n = parseInt32(val); if (n < 0 || n > 255) throw new Error("OverflowException"); r.killCam = n; r.updateRoomInfo(); return `${titleCase(opt)} ${n} olaraq dəyişdirildi`; }
        default: return `${titleCase(opt)} əmri tapılmadı!`;
      }
    },
  },
  {
    command: "sys", description: "Server parametrlərini dəyişdir", permission: "developercommand", args: "%seçim% %dəyər%",
    async execute(a, p) {
      const opt = lower(a[0]), val = lower(a[1]);
      const onOff = (k: "debug" | "test" | "debugPing", label: string) => {
        const f = parseInt32(val) === 1;
        if (f === sys[k]) return `${label} Rejimi artıq dəyişdirilib: ${f ? "Açıq" : "Bağlı"}`;
        sys[k] = f;
        return `${titleCase(opt)} Rejimi '${f ? "Aktivləşdirildi" : "Söndürüldü"}'`;
      };
      switch (opt) {
        case "udp": {
          const n = parseInt32(val);
          if (n === sys.udpType) return `UDP Vəziyyəti artıq dəyişdirilib: ${sys.udpType}`;
          if (n < 1 || n > 4) return `UDP Vəziyyəti ${n} olaraq dəyişmək mümkün deyil`;
          sys.udpType = n;
          return `${titleCase(opt)} Vəziyyəti Dəyişdirildi (${n} - ${UDP_NAMES[n]})`;
        }
        case "debug": return onOff("debug", "Debug");
        case "test": return onOff("test", "Test");
        case "ping": return onOff("debugPing", "Ping");
        case "reload":
          if (val === "pase") { await loadBattlePass(); send(p, seasonChallengeInfoAck(p)); return "CHALLENGE_INFO_ACK yeniləndi!"; }
          if (val === "classic_mode") return "Klassik Rejim Meneceri yeniləndi!";
          return `${titleCase(opt)} Yanlış 'reload' seçimi: ${val}. 'pase' və ya 'classic_mode' istifadə edin.`;
        case "title":
          if (val !== "all") return `${titleCase(opt)} Arqumentlər düzgün deyil!`;
          void unlockAllTitles(p);
          return `${titleCase(opt)} Uğurla Açıldı!`;
        default: return `${titleCase(opt)} əmri tapılmadı!`;
      }
    },
  },
  {
    command: "teamcash", description: "Komandaya cash göndər", permission: "gamemastercommand", args: "%komanda% %cash% (Komanda = FR/CT)",
    async execute(a, p) {
      const r = roomOf(p);
      if (!r) return "Zəhmət olmasa əmri otaqda icra edin";
      if (a.length !== 2) return "Düzgün istifadə: :teamcash %komanda% %cash%";
      const v = tryInt(a[1]);
      if (v === null) return "Zəhmət olmasa düzgün rəqəm daxil edin";
      const team = a[0].toLowerCase();
      if (team !== "red" && team !== "blue") return "Zəhmət olmasa düzgün komanda seçin: 'red' və ya 'blue'";
      const t = team === "red" ? 0 : 1;
      for (let i = 0; i < 18; i++) {
        if (i % 2 !== t) continue;
        const s = r.slots[i];
        const x = s && s.playerId > 0n ? r.svc.getAccount(s.playerId) : null;
        if (x && (await dao.addMoney(x, 0, v))) send(x, pointCashAck(0, x)); // by delta, never x.cash + v from memory
      }
      return `'${v}' cash ${team} komandasına göndərildi`;
    },
  },
  {
    command: "title", description: "Bütün titulları aç", permission: "gamemastercommand", args: "",
    async execute(_a, p) { await unlockAllTitles(p); return "Bütün titullar uğurla açıldı!"; },
  },
  {
    command: "reports", description: "Oyunçu şikayətlərini siyahıla (bir nickə aid)", permission: "moderatorcommand", args: "%nick% (istəyə bağlı, boşluqlu niklər üçün \"dırnaq\")",
    async execute(a, p) {
      const nick = tokenize(a.join(" "))[0]?.value;
      toChat(p, await reportsSummary(nick));
      return nick ? `'${nick}' üçün şikayətlər göstərildi` : "Son şikayətlər göstərildi";
    },
  },
  {
    command: "mute", description: "Oyunçunu çatda susdur (0 dəqiqə = qaldır)", permission: "moderatorcommand", args: "%nick% %dəqiqə%",
    async execute(a, p) {
      const tk = tokenize(a.join(" "));
      const minutes = tk.length >= 2 ? tryInt(tk[tk.length - 1].value) : null;
      if (minutes === null || minutes < 0 || minutes > 43200) return "Düzgün istifadə: :mute %nick% %dəqiqə% (0 - 43200)";
      const nick = tk.slice(0, -1).map((x) => x.value).join(" ");
      const t = await gm.byNick(nick);
      if (!t) return `${nick} nikli oyunçu tapılmadı!`;
      if (t.playerId === p.playerId) return "Özünüzü susdura bilməzsiniz";
      if (t.access > p.access) return "Sizdən yüksək səviyyəli oyunçunu susdura bilməzsiniz";
      await applyMute(t.playerId, minutes, `GM :mute by ${p.nickname}`);
      if (minutes === 0) { send(t, lobbyChatAck(0, "Server", 5, false, "Artıq çatda yaza bilərsiniz.")); return `'${t.nickname}' oyunçusunun susturması qaldırıldı`; }
      send(t, lobbyChatAck(0, "Server", 5, false, `Moderator tərəfindən ${minutes} dəqiqəlik susduruldunuz.`));
      toAllChat(`'${t.nickname}' oyunçusu ${minutes} Dəqiqə susduruldu!`);
      return `'${t.nickname}' oyunçusu ${minutes} Dəqiqə susduruldu`;
    },
  },
  {
    command: "bugs", description: "Son xəta hesabatlarını siyahıla", permission: "moderatorcommand", args: "%n% (istəyə bağlı, standart 5)",
    async execute(a, p) {
      const n = tryInt(a[0]) ?? 5;
      toChat(p, await bugsSummary(n));
      return `Son ${Math.max(1, Math.min(20, n))} xəta hesabatı göstərildi`;
    },
  },
  {
    command: "refreshshop", description: "Mağaza kataloqunu yenilə", permission: "gamemastercommand", args: "",
    async execute(_a, p) {
      await loadShop(); // C#: ShopManager.Reset + Load(1); the TS catalog builder needs both loads
      const c = p.connection as GameClient | null;
      if (c) { for (const b of gp.fullCatalog(p, true)) c.session.send(b); c.session.send(gp.saillistAck(true)); }
      return "Mağaza uğurla yeniləndi";
    },
  },
  {
    command: "player", description: "Oyunçu dəyərlərini dəyişdir", permission: "gamemastercommand", args: "%seçim1% %seçim2% %dəyər% %uid%",
    async execute(a, p, quoted) {
      if (a[0]?.toLowerCase() === "title") return executeTitle(a[1], !!quoted[1], p); // [RECRIADO] web build: unlock every title of another player
      const o1 = lower(a[0]), o2 = lower(a[1]);
      if (o1 === "xtx") return executeXtx(o2, a, p, quoted);
      const USAGE = "İstifadə: player gift <gold|cash|tags|item> <dəyər|goodsId> <uid|nick> | player kick <nick|uid> <uid|nick> <saniyə> | player ban <normal|permanent> <gün> <uid|nick>";
      if (!o1) return USAGE;
      // [RECRIADO] shorthand for the web build: "player kick <nick|uid> [seconds]" -> "player kick nick|uid <seconds> <target>"
      if (o1 === "kick" && (quoted[1] || (o2 !== "uid" && o2 !== "nick"))) {
        if (!a[1]) return "İstifadə: player kick <nick|uid> [saniyə]";
        a = ["kick", tryLong(a[1]) !== null && !quoted[1] ? "uid" : "nick", a[2] ?? "0", a[1]];
        quoted = [false, false, false, quoted[1]];
      }
      if (a[3] === undefined || tryInt(a[2]) === null) return USAGE;
      const val = parseInt32(a[2]);
      // a "quoted" target is always a nick: a player named "1001" must not turn a GM's ban / gift into one on UID 1001
      const uid = quoted[3] ? null : tryLong(a[3]), isUid = uid !== null;
      const who = () => (isUid ? `UID: ${uid}` : `Nickname: ${a[3]}`);
      const find = async () => (isUid ? await gm.byPid(uid!) : await gm.byNick(a[3]));
      switch (o1) {
        case "gift": {
          const t = await find();
          const money = async (col: "gold" | "cash" | "tags") => {
            if (!t) return `${who()} olan oyunçu tapılmadı!`;
            // by delta (a negative gift only takes what the row still holds); t's balance is read back
            if (!(await dao.addMoney(t, col === "gold" ? val : 0, col === "cash" ? val : 0, col === "tags" ? val : 0))) return `${titleCase(o1)} Əmr yanlışdır və ya tapılmadı!`;
            send(t, pointCashAck(0, t));
            return `UID: ${t.playerId} (${t.nickname}) oyunçusuna ${val} ${titleCase(o2)} verildi`;
          };
          switch (o2) {
            case "gold": return money("gold");
            case "cash": return money("cash");
            case "tags": return money("tags");
            case "item": {
              if (!t) return `${who()} olan oyunçu tapılmadı!`;
              const g = getGood(val);
              if (!g) return `Goods Id: ${val} tapılmadı!`;
              const item = g.item.clone();
              send(t, rewardPopupAck(p, item));
              // C#: the character check and CreateCharacter use the invoker (Player), the 3334 goes to the target (kept)
              if (Math.trunc(item.id / 100000) === 6 && !p.character.getCharacter(item.id)) await grantItem(p, item);
              else { await tryCreateItem(item, t); send(t, gp.inventoryGetInfoAck(0, t, [item])); }
              return `UID: ${t.playerId} (${t.nickname}) oyunçusuna ${item.name} verildi`;
            }
          }
          break;
        }
        case "kick": {
          const by = lower(a[1]); // not o2: the shorthand above rewrote a[1] to "uid" / "nick"
          const t = by === "uid" ? await gm.byPid(uid ?? -1n) : by === "nick" ? await gm.byNick(a[3]) : null;
          if (by !== "uid" && by !== "nick") break;
          const label = by === "uid" ? `UID: ${uid}` : `Nickname: ${a[3]}`;
          if (!t || !t.connection) return `${label} olan oyunçu tapılmadı!`;
          if (by === "uid" ? t.playerId === p.playerId : t.nickname === p.nickname) return `${label} - Uğursuz! (Özünüzü çıxara bilməzsiniz)`;
          if (t.access > p.access) return `${label} - Uğursuz! (Sizdən yüksək səviyyəli oyunçunu çıxara bilməzsiniz)`;
          send(t, kickAck());
          closeAccount(t, (val * 1000) % 1000); // TimeSpan.FromSeconds(n).Milliseconds: the ms component (0 for whole seconds)
          return `${label} oyunçusu ${val} Saniyədə çıxarıldı!`;
        }
        case "ban": {
          if (o2 !== "normal" && o2 !== "permanent") break;
          const t = await find();
          if (!t) return `${who()} olan oyunçu tapılmadı!`;
          if (t.playerId === p.playerId) return `${who()} - Uğursuz! (Özünüzü banlaya bilməzsiniz)`;
          if (t.access > p.access) return `${who()} - Uğursuz! (Sizdən yüksək səviyyəli oyunçunu banlaya bilməzsiniz)`;
          const days = o2 === "normal" ? val : 999;
          const oid = await saveBan(t, days);
          if (oid === null) return `${titleCase(o1)} Əmr yanlışdır və ya tapılmadı!`;
          await dao.update1("accounts", "ban_object_id", oid.toString(), "player_id", t.playerId);
          toAllChat((o2 === "normal" ? `'${t.nickname}' oyunçusu ${days} Gün banlandı!` : `'${t.nickname}' oyunçusu daimi olaraq banlandı!`));
          t.banObjectId = oid;
          send(t, kickAck());
          closeAccount(t, 1000);
          return `${who()} üçün ${days} Günlük ban uğurla tətbiq edildi`;
        }
      }
      return `${titleCase(o1)} əmri tapılmadı!`;
    },
  },
];

async function executeXtx(o2: string, a: string[], p: Account, quoted: boolean[]): Promise<string> {
  switch (o2) {
    case "ci": {
      if (a.length < 3) return "İstifadə: player xtx ci <GoodsId|ItemId>";
      const v = tryInt(a[2]);
      if (v === null) return `Yanlış dəyər: ${a[2]}`;
      const it = resolveItem(v);
      if (!it) return `Əşya tapılmadı. '${v}' düzgün GoodsId və ya ItemId deyil.`;
      await grantWithPopup(p, it);
      return `Xtx ${it.name || it.id} özünüzə verildi (${p.nickname})`;
    }
    case "cia": {
      if (a.length < 4) return "İstifadə: player xtx cia <GoodsId|ItemId> <UID|Nick>";
      const v = tryInt(a[2]);
      if (v === null) return `Yanlış dəyər: ${a[2]}`;
      const uid = quoted[3] ? null : tryLong(a[3]);
      const t = uid !== null ? await gm.byPid(uid) : await gm.byNick(a[3]);
      if (!t) return `${uid !== null ? `UID: ${uid}` : `Nick: ${a[3]}`} olan oyunçu tapılmadı!`;
      if (t.playerId === p.playerId) return "Özünüzə əşya vermək üçün 'ci' istifadə edin.";
      const it = resolveItem(v);
      if (!it) return `Əşya tapılmadı. '${v}' düzgün GoodsId və ya ItemId deyil.`;
      await grantWithPopup(t, it);
      return `Xtx ${it.name || it.id} UID: ${t.playerId} (${t.nickname}) oyunçusuna verildi`;
    }
  }
  return `Xtx ${o2} əmri tapılmadı!`;
}

/** AllUtils.ServerCommands -> CommandManager.TryParse: true when the text was a command the player may run. */
export async function serverCommands(p: Account, text: string): Promise<boolean> {
  const reply = (t: string) => send(p, lobbyChatAck(0, "Server", 5, false, t));
  try {
    const t = text.trim();
    if (t.length === 0 || !t.startsWith(":")) return false;
    let name = t.slice(1), args: string[] = [], quoted: boolean[] = [];
    if (name.includes(" ")) { const parts = name.split(" "); name = parts[0]; args = parts.slice(1); }
    const cmd = COMMANDS.find((c) => c.command === name);
    if (!cmd || !havePermission(p, cmd.permission)) return false;
    // [web] the level of the login goes stale when the account is demoted in the DB: one read per command, fail closed
    const now = (await gm.accessOf(p.playerId)) ?? 0;
    if (now !== p.access) { log(`Player '${p.nickname}' (UID: ${p.playerId}) access ${p.access} -> ${now} (DB)`); p.access = now; }
    if (!havePermission(p, cmd.permission)) return false;
    if (name === "player") {
      // [RECRIADO] quote-aware for the targets: "nick with spaces" is one token and a quoted number stays a nick (the C# split on spaces)
      const rest = t.slice(1 + name.length), tk = tokenize(rest);
      args = tk.map((x) => x.value); quoted = tk.map((x) => rest[x.start] === "\"");
    }
    const result = await cmd.execute(args, p, quoted);
    reply(result);
    log(`Player '${p.nickname}' (UID: ${p.playerId}) Running Command '${text}'`);
    return true;
  } catch (e) {
    log(`command '${text}' by ${p.nickname}: ${(e as Error).message}`);
    reply(getLabel("CommandsExceptionError"));
    return true;
  }
}
