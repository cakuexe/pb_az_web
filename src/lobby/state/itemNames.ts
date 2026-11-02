// Item names. Protocol 1039 carries no names, so names come from data:
//   1. a provider set with setItemNameProvider()  <- hook to swap/override the source
//   2. the client's PT-BR names: public/assets/ui/strings/items.pt-BR.json (PBCross .pef + String.i3Pack Brazil
//      table, tools ui-export/ui-strings.mjs; weapons and sets). Only `name` is used.
//   2b. names set by the 2017 item audit (public/assets/ui/complete-items-2017.json `names`, charaSupport.ts): coupon
//      days ("EXP Up 110% 7 dias" from system_shop_effects) and the 2017 client's own part names (String.i3Pack) for
//      items whose server name is a raw key (A_H_Skull)
//   3. server snapshot data/itemNames.json (system_shop.item_name, system_shop_effects.coupon_name,
//      ItemStatistics.xml; regenerate with `node src/lobby/state/data/export-item-names.mjs`)
//   4. the Cross icon index name (public/assets/ui/cross/icons/index.json, .pef key), when loadIconIndex() ran
//   5. "#<itemId>"  (no name known: shown as is, never invented)
// Hangul names are skipped at every level.
export type NameSource = "provider" | "client-pt-BR" | "audit-2017" | "system_shop" | "system_shop_effects" | "ItemStatistics.xml" | "icon-pef" | "none";
export interface ItemName { name: string; source: NameSource }

export type ItemNameProvider = (itemId: number) => string | null | undefined;

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
let provider: ItemNameProvider | null = null;
let liveNames: Record<string, string> = {};
let client: Record<string, string> = {};
/** items.pt-BR.json `key` (the .pef path, e.g. "Weapon\\Gun\\K-2"): ties an item to its STBL_IDX_WD_* description */
let clientKeys: Record<string, string> = {};
let table: Record<string, [string, string]> = {};
let iconNames: Record<string, string> = {};
let auditNames: Record<string, string> = {};

/**
 * Server itemId -> the id items.pt-BR.json uses. That file follows the 2017 pack numbering, which differs from the
 * server's for throwables (server 407004 K-413 = pack 407008, while pack 407004 is the C-5; weapons/throwables.ts
 * pack2017Id): looked up as is, the K-413 family showed C-5 / C-5 PBWC names. 0 = no client entry for that item.
 */
let clientId: (itemId: number) => number = (id) => id;
export function setClientIdMap(fn: ((itemId: number) => number) | null): void { clientId = fn ?? ((id) => id); }

/** Hook: replaces (or with null, removes) the first name source. */
export function setItemNameProvider(p: ItemNameProvider | null): void { provider = p; }

/** Server snapshot (tests/Node pass the parsed JSON; the browser uses loadItemNames()). */
export function setItemNameTable(json: { names: Record<string, [string, string]> }): void { table = json.names ?? {}; }

/** items.pt-BR.json: `{ "<itemId>": { name, desc, key } }` -> names only. */
export function setClientItemNames(json: Record<string, { name?: string; key?: string }>): void {
  client = {};
  clientKeys = {};
  for (const [id, v] of Object.entries(json)) {
    if (v && typeof v.name === "string" && v.name.trim()) client[id] = v.name.trim();
    if (v && typeof v.key === "string") clientKeys[id] = v.key;
  }
}

/** complete-items-2017.json `names` (charaSupport.ts). */
export function setAuditItemNames(names: Record<string, string>): void { auditNames = names; }

/** Names from icon index (`icons[id].name`). */
export function setIconNames(names: Record<string, string>): void { iconNames = names; }

let loading: Promise<void> | null = null;
/** Browser: client names (fetch) + server snapshot (lazy chunk, ~400 KB) when a meta screen opens. */
export function loadItemNames(uiBase = "/assets/ui"): Promise<void> {
  return (loading ??= Promise.all([
    fetch(`${location.protocol}//${location.hostname}:8090/api/catalog/names`)
      .then((r) => (r.ok ? r.json() : { names: {} }))
      .then((v: { names?: Record<string, string> }) => {
        liveNames = v.names ?? {};
        setItemNameProvider((id) => liveNames[String(id)]);
      }).catch(() => {}),
    fetch(`${uiBase}/strings/items.pt-BR.json`).then((r) => (r.ok ? r.json() : {})).then(setClientItemNames).catch(() => {}),
    import("./data/itemNames.json").then((m) => setItemNameTable(((m as { default?: unknown }).default ?? m) as { names: Record<string, [string, string]> })),
    import("../../weapons/throwables.ts").then((t) => setClientIdMap((id) => (t.isServerThrowable(id) ? t.pack2017Id(id) : id))),
  ]).then(() => {}).catch((e) => { loading = null; console.warn("[lobby] item names not loaded", e); }));
}

const ok = (s: string | null | undefined): s is string => !!s && !HANGUL.test(s);

export function itemName(itemId: number): ItemName {
  const id = String(itemId);
  const p = provider?.(itemId);
  if (ok(p)) return { name: p, source: "provider" };
  const cid = String(clientId(itemId));
  if (ok(client[cid])) return { name: client[cid], source: "client-pt-BR" };
  if (ok(auditNames[id])) return { name: auditNames[id], source: "audit-2017" };
  const t = table[id];
  if (t && ok(t[0])) return { name: t[0], source: t[1] as NameSource };
  if (ok(iconNames[id])) return { name: iconNames[id], source: "icon-pef" };
  return { name: `#${itemId}`, source: "none" };
}

/** Azerbaijani display label for weapons; model/brand names stay intact and only descriptive modifiers are localised. */
export function displayItemName(itemId: number): string {
  const raw = itemName(itemId).name;
  const couponNames: Record<number, string> = {
    1700026: "Sürətli silah dəyişmə",
    1700027: "Sürətli doldurma",
    1700033: "İşıq qumbarasından qorunma",
    1700034: "Sürətli C4 dəsti",
    1700035: "Əlavə qumbara cibi",
    1700191: "Əlavə xüsusi bomba cibi",
    1700211: "Əlavə xüsusi bomba cibi",
    1700008: "Əlavə güllə 40%",
    1700185: "Əlavə güllə 10%",
  };
  if (couponNames[itemId]) return couponNames[itemId];
  const cls = Math.floor(itemId / 100000);
  if (cls < 1 || cls > 5 || raw.startsWith("#")) return raw;
  return raw
    .replace(/\s+Ext\.$/i, " Təkmil.")
    .replace(/\s+G\.$/i, " Qızıl")
    .replace(/\bReinforced\b/gi, "Gücləndirilmiş")
    .replace(/\bGold\b/gi, "Qızıl")
    .replace(/\bSilver\b/gi, "Gümüş")
    .replace(/\bBronze\b/gi, "Bürünc")
    .replace(/\bBlack\b/gi, "Qara")
    .replace(/\bWhite\b/gi, "Ağ")
    .replace(/\bRed\b/gi, "Qırmızı")
    .replace(/\bBlue\b/gi, "Mavi")
    .replace(/\bGreen\b/gi, "Yaşıl")
    .replace(/\bYellow\b/gi, "Sarı")
    .replace(/\bCamo\b/gi, "Kamuflyaj")
    .replace(/\bTiger\b/gi, "Pələng")
    .replace(/\bDragon\b/gi, "Əjdaha")
    .replace(/\bDual\b/gi, "Qoşa")
    .replace(/\bKnife\b/gi, "Bıçaq")
    .replace(/\bGrenade\b/gi, "Qumbara")
    .replace(/\bSmoke\b/gi, "Tüstü")
    .replace(/\bFlash\s*Bang\b/gi, "İşıq qumbarası")
    .replace(/\bSpecial\b/gi, "Xüsusi")
    .replace(/\bCustom\b/gi, "Fərdi");
}
