// Which characters/equip parts and item-tab goods the web client exposes: only those COMPLETE in the Cross client.
//   characters (class 6): public/assets/chars/complete-cross.json (pb-extract-tools audit-charas-cross.mjs: system_shop-sold Character
//     itemId with an exported chars/index.json model + skeleton + hitboxes + a swat_male/female clip source);
//   head / face / beret (7, 8, 27) and the Item tab (coupons 17, function items 18, cards, ...):
//     public/assets/ui/complete-items-cross.json (pb-extract-tools audit-items-cross.mjs: Cross pef / exported accessory
//     (pb-extract-tools export-headgear.mjs) + icon + a real name + a server effect). Parts 9..14 have no export yet: never complete.
// Display filter only: incomplete items are hidden from the shop and the inventory (the inventory keeps equipped / active /
// basic ones, model.ts); the DB, the server and the player's loadout are untouched. Re-enable an item by exporting what
// it lacks and re-running the audit. The items file also carries `names` the lobby would not resolve by itself (coupon
// days, Cross part names), handed to itemNames.ts.
import { setAuditItemNames } from "./itemNames.ts";

let complete: Set<number> | null = null;
let items: Set<number> | null = null;
let loading: Promise<void> | null = null;

/** Tests/Node: the parsed complete-cross.json (null = no filter). */
export function setCharaSupport(json: { complete: number[] } | null): void {
  complete = json ? new Set(json.complete) : null;
}

/** Tests/Node: the parsed complete-items-cross.json (null = no filter). */
export function setItemSupport(json: { complete: number[]; names?: Record<string, string> } | null): void {
  items = json ? new Set(json.complete) : null;
  setAuditItemNames(json?.names ?? {});
}

/** Browser: fetch once; a failed fetch leaves that filter off (every item shown) rather than hiding them all. */
export function loadCharaSupport(base = "/assets/chars", uiBase = "/assets/ui"): Promise<void> {
  return (loading ??= Promise.all([
    fetch(`${base}/complete-cross.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { complete?: number[] } | null) => { if (Array.isArray(j?.complete)) setCharaSupport({ complete: j.complete }); }),
    fetch(`${uiBase}/complete-items-cross.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { complete?: number[]; names?: Record<string, string> } | null) => { if (Array.isArray(j?.complete)) setItemSupport({ complete: j.complete, names: j.names }); }),
  ].map((p) => p.catch(() => {}))).then(() => {}));
}

const isPart = (itemId: number) => { const c = Math.floor(itemId / 100000); return c === 7 || c === 8 || c === 27; };

/** false = a chara/part item not complete in Cross (hidden); true when its filter has not loaded yet. */
export function isCharaComplete(itemId: number): boolean {
  if (isPart(itemId) && items) return items.has(itemId) || !!complete?.has(itemId);
  return !complete || complete.has(itemId);
}

/** false = an Item-tab good (coupon, function item, card, ...) not complete in Cross (hidden); true before the list loads. */
export function isItemComplete(itemId: number): boolean {
  if (!items) return true;
  if (items.has(itemId)) return true;
  // Shop coupons are class 17 (17 DD GGG, with DD = duration) while Cross stores the icon/effect under the
  // activated function item 16 00 GGG. A complete class-16 effect therefore makes every duration of its coupon
  // displayable in the Item shop.
  if (Math.floor(itemId / 100000) === 17) {
    const activeId = 1600000 + (itemId % 1000);
    // Both ids are real ExtraThrowGrenade effects. 1600191 owns the Cross icon; 1600211 is the second shop
    // variant and deliberately reuses it.
    if (activeId === 1600191 || activeId === 1600211) return true;
    return items.has(activeId);
  }
  return false;
}
