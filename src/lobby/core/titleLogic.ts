// Perfil / Títulos phase (UIPhaseProfile, PointBlankRe_MyInfomation + _Designation): title rules and texts, no DOM.
// Rules mirror server profileHandlers.ts handleTitleChange / handleTitleEquip / handleTitleRelease (the C#
// PROTOCOL_BASE_USER_TITLE_*_REQ), so the client greys out exactly what the server would refuse. Texts are the
// client's own STR_TBL_DESIGNATION_* / STR_HEADER_* (pt-BR.json); Lua flow of the scene: PointBlankRe_MyInfomation_Designation.lua.
import { tOr } from "../ui/i18n.ts";
import { cleanLabel } from "../screens/strings.ts";
import { AUTHORITY_EFFECTS, EFFECTS, TITLES, type TitleDef } from "./titleData.ts";

export const TITLE_COUNT = TITLES.length;
/** equip slots of the profile (i3UIButtonMySlot1..3); `slots` of the account says how many are unlocked */
export const TITLE_SLOTS = 3;
export const titleDef = (id: number): TitleDef | undefined => (id >= 1 && id <= TITLE_COUNT ? TITLES[id - 1] : undefined);

export interface TitleState {
  /** bit `id` set = title owned (server PlayerTitles.Flags, `1 << id`) */
  flags: bigint;
  equiped: [number, number, number];
  slots: number;
  /** badges consumed by getting titles (2363): Broche / Insígnia / Medalha / Ordem Azul */
  ribbon: number; ensign: number; medal: number; master: number;
  /** false until the first 2383 of the session arrived */
  known: boolean;
}
export const emptyTitleState = (): TitleState => ({ flags: 0n, equiped: [0, 0, 0], slots: 1, ribbon: 0, ensign: 0, medal: 0, master: 0, known: false });

export const hasTitle = (s: TitleState, id: number): boolean => id > 0 && (s.flags & (1n << BigInt(id))) !== 0n;
export const titleSlotOf = (s: TitleState, id: number): number => s.equiped.indexOf(id);

/** why handleTitleChange would refuse `def` (null = it would accept) */
export type GetBlock = "owned" | "rank" | "badges" | "required";
export function getBlock(s: TitleState, rank: number, d: TitleDef): GetBlock | null {
  if (hasTitle(s, d.id)) return "owned";
  if (rank < d.rank) return "rank";
  if (s.ribbon < d.ribbon || s.ensign < d.ensign || s.medal < d.medal || s.master < d.master) return "badges";
  if ((d.req1 && !hasTitle(s, d.req1)) || (d.req2 && !hasTitle(s, d.req2))) return "required";
  return null;
}

/** why handleTitleEquip would refuse `id` in `slot` (null = it would accept); slot >= slots is locked (client rule: the Lock icon) */
export type EquipBlock = "locked" | "notOwned" | "already" | "sameClass";
export function equipBlock(s: TitleState, id: number, slot: number): EquipBlock | null {
  const d = titleDef(id);
  if (slot < 0 || slot >= TITLE_SLOTS || slot >= s.slots) return "locked";
  if (!d || !hasTitle(s, id)) return "notOwned";
  if (s.equiped.includes(id)) return "already";
  if (s.equiped.some((e, i) => i !== slot && e && titleDef(e)?.classId === d.classId)) return "sameClass";
  return null;
}

// ------------------------------------------------------------------------------------------------ texts

/** STR_TBL_DESIGNATION_NAME_NO<set-1> (the table indexes DesignationSet, not the wire id) */
const AZ_TITLE_NAMES = [
  "Sıravi döyüşçü","Baş döyüşçü","Üstün döyüşçü","Mütəxəssis döyüşçü","Hücum əsgəri","Snayper əsgəri","Dəstək əsgəri","Hücumçu sıravi","Kəşfiyyatçı sıravi","Snayper sıravi","Atıcı sıravi","Dəstəkçi sıravi","Basqınçı sıravi","Partlayışçı sıravi","Baş hücumçu","Üstün kəşfiyyatçı","Baş snayper","Üstün atıcı","Baş dəstəkçi","Üstün basqınçı","Baş partlayışçı","Üstün hücumçu","Kəşfiyyat zabiti","Üstün snayper","Atıcı zabiti","Üstün dəstəkçi","Basqın zabiti","Üstün partlayışçı","Hücum zabiti","Snayper zabiti","Dəstək zabiti","Partlayış zabiti","Hücum komandiri","Kəşfiyyat komandiri","Snayper komandiri","Atıcı komandiri","Dəstək komandiri","Basqın komandiri","Vəhşi döyüşçü","Səssiz qatil","Atəş ulduzu","Çevik kölgə","Ali dağıdıcı","Partlayış komandiri",
];
const AZ_TITLE_EXPLAINS = [
  "Təkmil döyüş hazırlığına yeni başlayan sıravilərə verilir.","İlkin təlimlərdə yaxşı nəticə göstərənlərə verilir.","Gündəlik tapşırıqları uğurla bitirən onbaşılara verilir.","Yüksək döyüş bacarığı göstərən çavuşlara verilir.","Piyada məktəbini bitirənlərə verilir.","Kəşfiyyat məktəbini bitirənlərə verilir.","Döyüş mühəndisliyi məktəbini bitirənlərə verilir.","Atıcı məktəbinə yeni başlayanlara verilir.","Kəşfiyyat məktəbinə yeni başlayanlara verilir.","Snayper məktəbinə yeni başlayanlara verilir.","Yaxın döyüş məktəbinə yeni başlayanlara verilir.","Dəstək atəşi məktəbinə yeni başlayanlara verilir.","Hücum məktəbinə yeni başlayanlara verilir.","Partlayıcı hazırlığı məktəbinə yeni başlayanlara verilir.","Atıcı məktəbində nümunəvi nəticəyə görə verilir.","Kəşfiyyat məktəbində nümunəvi nəticəyə görə verilir.","Snayper məktəbində nümunəvi nəticəyə görə verilir.","Yaxın döyüş məktəbində nümunəvi nəticəyə görə verilir.","Dəstək atəşi məktəbində nümunəvi nəticəyə görə verilir.","Hücum məktəbində nümunəvi nəticəyə görə verilir.","Partlayıcı hazırlığında nümunəvi nəticəyə görə verilir.","Atıcı məktəbini bitirənlərə verilir.","Kəşfiyyat məktəbini bitirənlərə verilir.","Snayper məktəbini bitirənlərə verilir.","Yaxın döyüş məktəbini bitirənlərə verilir.","Dəstək atəşi məktəbini bitirənlərə verilir.","Hücum məktəbini bitirənlərə verilir.","Partlayıcı hazırlığını bitirənlərə verilir.","Döyüş meydanında bacarığını təkmilləşdirən təcrübəli hücumçulara verilir.","Döyüş meydanında bacarığını təkmilləşdirən təcrübəli snayperlərə verilir.","Döyüş meydanında bacarığını təkmilləşdirən dəstəkçilərə verilir.","Döyüş meydanında bacarığını təkmilləşdirən partlayışçılara verilir.","Döyüş tapşırıqlarında fərqlənən veteran hücumçulara verilir.","Döyüş tapşırıqlarında fərqlənən veteran kəşfiyyatçılara verilir.","Döyüş tapşırıqlarında fərqlənən veteran snayperlərə verilir.","Döyüş tapşırıqlarında fərqlənən yaxın döyüş ustalarına verilir.","Döyüş tapşırıqlarında fərqlənən veteran dəstəkçilərə verilir.","Döyüş tapşırıqlarında fərqlənən veteran basqınçılara verilir.","Döyüş ruhunu ən yaxşı təmsil edən piyadalara verilən xüsusi nişan.","Hədəfi qaçırmayan ən dəqiq və ölümcül döyüşçülərə verilən xüsusi nişan.","Yaxın döyüşün ən bacarıqlı ustalarına verilən xüsusi nişan.","Tapşırığı fasiləsiz atəşlə qoruyan inadkar döyüşçülərə verilən xüsusi nişan.","Yolu partlayışlarla açan ən çevik dağıdıcılara verilən xüsusi nişan.","Döyüş tapşırıqlarında fərqlənən veteran partlayışçılara verilir.",
];
export const titleName = (d: TitleDef): string => AZ_TITLE_NAMES[d.set - 1] ?? cleanLabel(tOr(`STR_TBL_DESIGNATION_NAME_NO${d.set - 1}`, `#${d.id}`));
/** STR_TBL_DESIGNATION_EXPLAIN_NO<set-1>; some titles have none */
export const titleExplain = (d: TitleDef): string => AZ_TITLE_EXPLAINS[d.set - 1] ?? cleanLabel(tOr(`STR_TBL_DESIGNATION_EXPLAIN_NO${d.set - 1}`, ""));
const azMilitary = (s: string) => s.replace(/Senior Trainee/gi,"Baş kursant").replace(/Trainee/gi,"Kursant").replace(/Private/gi,"Sıravi").replace(/Corporal/gi,"Onbaşı").replace(/Sergeant/gi,"Çavuş").replace(/Lieutenant/gi,"Leytenant").replace(/Captain/gi,"Kapitan").replace(/Major/gi,"Mayor").replace(/Colonel/gi,"Polkovnik").replace(/General/gi,"General").replace(/Commander/gi,"Komandir").replace(/Specialist/gi,"Mütəxəssis");
export const rankName = (rank: number): string => azMilitary(cleanLabel(tOr(`STBL_IDX_RANK_${rank}`, `${rank}`)));

/** text of one effect id ("" = none): STR_HEADER_<key> of the exe's id table (CDesignationValueSet 0x4d29d0 -> _setUserTitleEffectText
 * 0x4d01f0). Authority ids (weapon unlocks) have no text of their own, see `effectRows`. */
export function effectText(id: number): string {
  const e = EFFECTS[id];
  const raw = e && e[0] ? cleanLabel(tOr(`STR_HEADER_${e[0]}`, "")) : "";
  return raw.replace(/Jump Height Up/gi,"Tullanma hündürlüyü +").replace(/Move Speed Up/gi,"Hərəkət sürəti +").replace(/Move Ability Up/gi,"Hərəkət qabiliyyəti +").replace(/Reload Time Reduce/gi,"Doldurma vaxtı -").replace(/Fire Speed Up/gi,"Atəş sürəti +").replace(/Weapon Recoil/gi,"Silah təpməsi").replace(/None|Indisponível/gi,"Yoxdur");
}

/** AuthWeaponClass / Number -> item id (Dragunov G = class 5, number 6 = 105006, which is also its server award) */
export const weaponItemId = (cls: number, num: number): number => 100000 + cls * 1000 + num;
export function weaponText(cls: number, num: number, nameOf: (itemId: number) => string): string {
  const name = nameOf(weaponItemId(cls, num));
  return name ? cleanLabel(tOr("STR_HEADER_AUTHORITY_WEAPON", "%s").replace("%s", name)) : "";
}

const NONE = (_n: 1 | 2 | 3): string => "Yoxdur";
const joined = (xs: string[], none: string): string => (xs.length ? xs.join("\n") : none);
/** Efeito + / Efeito - / Efeito extra rows of a title (i3UIEffectPlus / Minus / Add), UITabProfileDesignation::__UpdateDetailInfoBox
 * 0x950eb0: two slots per row, empty = "Indisponível" (NONE_WITH_COLOR1 / 2 / 3). Extra row, per slot: id 0 or an authority id ->
 * "Permissão de compra de <arma>" for the n-th weapon of the title (none -> nothing); other ids -> their effect text. */
export function effectRows(d: TitleDef, nameOf: (itemId: number) => string): { plus: string; minus: string; add: string } {
  const add: string[] = [];
  for (let i = 0; i < 2; i++) {
    const id = d.add[i] ?? 0;
    const t = !id || AUTHORITY_EFFECTS.includes(id)
      ? (d.weapon[i] ? weaponText(d.weapon[i][0], d.weapon[i][1], nameOf) : "")
      : effectText(id);
    if (t) add.push(t);
  }
  return { plus: joined(d.plus.map(effectText).filter(Boolean), NONE(1)), minus: joined(d.minus.map(effectText).filter(Boolean), NONE(2)), add: joined(add, NONE(3)) };
}

/** second line of the title name box (SetDesignTitle: "{blue}NAME_NO{/col}
{gray}NAME2_NO{/col}"; NAME2 is the title's English name) */
export const titleName2 = (d: TitleDef): string => cleanLabel(tOr(`STR_TBL_DESIGNATION_NAME2_NO${d.set - 1}`, ""));

/** count lines of the badge rows: "Possui %d und." (owned) / "Precisa de %d und." (needed) */
export const ownedText = (n: number): string => cleanLabel(tOr("STR_TBL_DESIGNATION_APPENDIX_BADGECOUNT_TEXT", "Possui %d und.")).replace("%d", String(n));
export const neededText = (n: number): string => cleanLabel(tOr("STR_TBL_DESIGNATION_NEEDED_BADGECOUNT_TEXT", "Precisa de %d und.")).replace("%d", String(n));

export const TS = {
  get select() { return cleanLabel(tOr("STR_TBL_DESIGNATION_GET_SELECT", "Escolha o título")); },
  get none() { return cleanLabel(tOr("STR_TBL_DESIGNATION_NONE_WITH_COLOR3", "Indisponível")); },
  get getText() { return cleanLabel(tOr("STR_TBL_DESIGNATION_GET_TEXT", "Adquirir Título")); },
  get useText() { return cleanLabel(tOr("STR_TBL_DESIGNATION_USE_TEXT", "Usar Título")); },
  get releaseText() { return cleanLabel(tOr("STR_TBL_DESIGNATION_RELEASE_TEXT", "Cancelar Título")); },
  get getAsk() { return cleanLabel(tOr("STR_TBL_DESIGNATION_GET_ANSWER_MESSAGE", "Deseja adquirir o título escolhido?")); },
  get equipAsk() { return cleanLabel(tOr("STR_TBL_DESIGNATION_EQUIP_ANSWER_MESSAGE", "Equipar o título escolhido?")); },
  get releaseAsk() { return cleanLabel(tOr("STR_TBL_DESIGNATION_RELEASE_ANSWER_MESSAGE", "Deseja cancelar o título escolhido?")); },
  get noSlot() { return cleanLabel(tOr("STR_TBL_DESIGNATION_NO_SELECTED_SLOT_MESSAGE", "Não foi escolhido slot.")); },
  get sameClass() { return cleanLabel(tOr("STR_TBL_DESIGNATION_FAIL_ANOTHER_USED", "Já está usando um Título do mesmo tipo.")); },
  get dupSlot() { return cleanLabel(tOr("STR_TBL_NETWORK_DUPLICATED_DESIGNATION_TYPE", "O título já está sendo usado em outro slot.")); },
  get notMatch() { return cleanLabel(tOr("STR_TBL_NETWORK_NOT_MATCH_BUY_DESIGNATION", "Condições para compra inadequadas.")); },
  get noEquipYet() { return cleanLabel(tOr("STR_TBL_GUI_BASE_NO_EQUIP_PRE_DESIGNATION", "Não é possível equipar antes de adquirir o título.")); },
  get gotIt() { return cleanLabel(tOr("STR_TBL_NETWORK_SUCESS_GET_DESIGNATION", "Obtenção de título realizada com sucesso.")); },
  get gotPrize() { return cleanLabel(tOr("STR_TBL_NETWORK_SUCESS_GET_DESIGNATION_WITH_PRIZE", "Você recebeu recompensa por ter adquirido o título.")); },
  get registered() { return cleanLabel(tOr("STR_TBL_NETWORK_REGISTER_DESIGNATION", "O título escolhido foi registrado com êxito.")); },
  get releaseFail() { return cleanLabel(tOr("STR_TBL_NETWORK_FAIL_RELEASE_DESIGNATION", "Falha no cancelamento de título.")); },
  get already() { return cleanLabel(tOr("STR_TBL_NETWORK_ALREADY_GET_DESIGNATION", "Já possui este título.")); },
  get slotHint() { return cleanLabel(tOr("STR_TBL_DESIGNATION_GET_EXPLAIN_MESSAGE", "Escolha o slot para equipar o título e confirme.")).split("\n")[0]; },
};
