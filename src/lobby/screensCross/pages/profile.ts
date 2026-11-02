// Cross profile page (UI_Project_Profile, CStepProfile 0x868c20): prProfileWin's two tabs. Títulos (designation): the title
// tree, the picked title's info and the "My Info" box with the 3 equip slots; Lobby2017 Perfil / Títulos (TitleClient
// 2376-2381): "hit node:<id>" picks a title, "hit slot<i>" an equip slot, double click on a slot equips / releases,
// "designation i3UIButtonConfirm" = Adquirir / Usar / Cancelar. Missão Pessoal (prChallengeSect, linked at 0xa73cb0): the card
// set combo, the 10 cards, the active card's 4 tasks and prize, Info+ / Comprar / Excluir, and the popups prCardShopWin (buy),
// prCardInfoWin (Info+) and prCardComplateWin (card / set finished); Lobby2017 Perfil / Missão (MissionClient 2355-2367):
// "profile <sub-tab>" + list "msets" pick a set, "hit mcard:<i>" a card, "missioncard" / "mbuy" / "mdetail" / "mdone" the buttons.
import type { GNode, I3Gui } from "../../ui/i3Gui.ts";
import { MAIN_BUTTONS } from "../../core/model.ts";
import { confirmMode } from "../../core/profile.ts";
import { paintMark } from "../clanMarkView.ts";
import { paintShapeIndex } from "../iconCanvas.ts";
import { TITLES } from "../../core/titleData.ts";
import { TITLE_SLOTS, effectRows, emptyTitleState, hasTitle, neededText, ownedText, rankName, titleDef, titleExplain, titleName } from "../../core/titleLogic.ts";
import { EVENT_SET, MISSION_TABS, MS, badgeName, badgeType, buttonState, cardAlpha, expText, goldText, missionSet, setListState, setName, slotOfSet, tabSets } from "../../core/missionLogic.ts";
import { detailPrize, notices, prize } from "../../core/missions.ts";
import { CARDS_PER_SET, TASKS_PER_CARD, emptyMissionState } from "../../../net/missionClient.ts";
import { itemName } from "../../state/itemNames.ts";
import { TEXT_FONT } from "../../ui/i3Gui.ts";
import { LEVEL_ICON } from "../crossMap.ts";
import { BASE, buildWindows, loadPack, nickCss, onClick, pageGui, setIcon, setTab, type PageCtx, type Texts } from "./common.ts";

const TEXTS: Texts = {
  Designation_Tree_Category_Key: ["STR_TBL_DESIGNATION_TREE", "Mapa dos Títulos"],
  // the 4 badge rows of the picked title: set once at init (0xa6fa50..0xa6fade), never cleared
  prDesigzationNeedKey0: ["STR_TBL_PROFILE_RIBBON_TEXT2", "Broche"], prDesigzationNeedKey1: ["STR_TBL_PROFILE_ENSIGN_TEXT2", "Insígnia"],
  prDesigzationNeedKey2: ["STR_TBL_PROFILE_MEDALS_TEXT2", "Medalha"], prDesigzationNeedKey3: ["STR_TBL_PROFILE_MASTER_MEDALS_TEXT", "Ordem Azul"],
  prDesigzationPlusEffectKey: ["STR_TBL_DESIGNATION_PLUS_EFFECT", "Efeito +:"], prDesigzationMinusEffectKey: ["STR_TBL_DESIGNATION_MINUS_EFFECT", "Efeito -:"],
  prDesigzationAddEffectKey: ["STR_TBL_DESIGNATION_ADD_EFFECT", "Efeito extra:"], prDesigzationGetInfoNameKey: ["STR_TBL_DESIGNATION_GET_INFO", "Informações"],
  prNeedDesigzationKey: ["STR_TBL_DESIGNATION_NEEDED_TEXT", "Título req.:"], prNeedRankKey: ["STR_TBL_DESIGNATION_NEEDED_GRADE_TEXT", "Nível req.:"],
  prDesigzationMyInfoBG_Text: ["STR_TBL_DESIGNATION_MYINFO_TEXT", "My Info"], prDesigzationMyInfo_DesignationKey: ["STR_TBL_DESIGNATION_TEXT", "Título"],
  // Missão Pessoal (cross-ui-map.json, str:exe)
  prCommonKey: ["STR_TBL_PROFILE_COMMON_CHALLENGE", "Missão em comum"], prCcBulletKey: ["STR_TBL_PROFILE_CHALLENGE_CARD_CONTENTS", "Conteúdo da missão"],
  prCardBulletKey: ["STR_TBL_PROFILE_REWARD_TEXT", "Recompensa"], prCardKey: ["STBL_IDX_SHOP_FILTER_CARD", "Carta"],
  prPrizeNameKey: ["STR_TBL_PROFILE_PRIZE_NAME", "Prêmio:"], prPrizeExpKey: ["STR_TBL_PROFILE_GET_EXP", "Experiência:"], prPrizePointKey: ["STR_TBL_PROFILE_GET_POINT", "Gold:"],
  prCardInfo: ["STR_TBL_PROFILE_CARD_INFO", "Info+"], prCardBuyAll: ["STR_TBL_PROFILE_CARD_BUY", "Comprar"], prCardDeleteAll: ["STR_TBL_PROFILE_CARD_DELETE", "Excluir"],
  prCardShopCaption: ["STR_TBL_PROFILE_NOTICE_TEXT", "Aviso"], prCardShopConfirm: ["STR_TBL_PROFILE_CARD_SHOP_CONFIRM", "Confirmar"],
  prCardShopCancel: ["STR_TBL_PROFILE_CARD_SHOP_CANCEL", "Cancelar"], prCardShopCurrentKey: ["STR_TBL_PROFILE_HOLD_POINT", "Gold:"],
  prCardShopRemainderKey: ["STR_TBL_PROFILE_REMAIN_MONEY", "Dinheiro restante:"], prCardShopNotice: ["STR_TBL_PROFILE_CARD_BUY_EXPLAIN", ""],
  prciCaption: ["STR_TBL_PROFILE_CHALLENGE_CARD_INFO", "Informação do cartão de missão"], prciConfirm: ["STR_TBL_PROFILE_CONFIRM", "Confirmar"],
  prciCardInfoTitle: ["STR_TBL_PROFILE_CARD_INFO", "Info+"], prciCardInfoPriceKey: ["STR_TBL_PROFILE_CARD_PRICE", "Preço:"],
  prciCardInfoPointKey: ["STR_TBL_PROFILE_TOTAL_GET_POINT", "Total de Gold adquirido:"], prciCardInfoExpKey: ["STR_TBL_PROFILE_TOTAL_GET_EXT", "Total de EXP adquirida:"],
  prciSupplyMedalTitle: ["STR_TBL_PROFILE_SUPPLY_MEDAL", "Medalhas fornecidas"], prciFinalPrizePointExpTitle: ["STR_TBL_PROFILE_LAST_REWARD_POINT", "EXP/Gold de recompensa final:"],
  prciFinalPrizePointTextKey: ["STR_TBL_PROFILE_CHALLENGE_PRIZE_POINT_TEXT", "Gold"], prciFinalPrizeExpTextKey: ["STR_TBL_PROFILE_CHALLENGE_PRIZE_EXP_TEXT", "Experiência"],
  prciFinalPrizeItemTextKey: ["STBL_IDX_CHARA_SLOT_TITLE4", "Item"],
  prCardComplateCaption: ["STR_TBL_PROFILE_NOTICE_TEXT", "Aviso"],
  // the exe relabels the confirm (strAll: GET / RELEASE / USE / CONFIRM): Confirmar here [INFERIDO]
  prCardComplateConfirm: ["STR_TBL_PROFILE_CONFIRM", "Confirmar"],
};

/** design-time option / event slots, the change-title window (the controller asks in the message box), the who / target combos,
 * the clan mark (no clan data on this page). Missão: prCardBuyOne (no STR in the exe's link, the 2017 buys whole sets only),
 * prCardInfoWin2 (a baked event image, card_cube_card = the 2016 Olympics set), the single-card dummy of the buy popup (0xa9cbe3
 * hides it, the set dummy shows the pack), the second item image of Info+ (one image per item here); Info+ draws the ribbon row in
 * prciSupplyMedalRibbonImage0 and the other three in MedalImage1..3 (0xa9db44 hides all eight, 0xa9dc19..0xa9dd21 shows four) */
const HIDDEN = [
  "prCardInfoWin2", "prDesigzationChangeBG", "prCardBuyOne", "prCardShopOneDummy", "prciFinalPrizeItemImage2",
  "prciSupplyMedalMedalImage0", ...[1, 2, 3].map((i) => `prciSupplyMedalRibbonImage${i}`),
  "prDesigzationMyInfo_Target_Combo", "prDesigzationMyInfo_Who_Combo","prDesigzationDeatailCategory", "Designation_Tree_Event_Category", // event titles: not in the tree data
  ...Array.from({ length: 6 }, (_, i) => `Designation_Tree_Option_Slot${i + 1}`),
];

const WINDOWS = ["prProfileWin", "prCardShopWin", "prCardInfoWin", "prCardComplateWin"];
/** Designation_Tree_Slot1..44 (0xa6f47b: 0x2c) */
const TREE_SLOTS = 0x2c;
/** tree slot N (1..44) -> title id: CStepProfile_Designation links Designation_Tree_Slot%d to the CDesignationSet entry N-1
 * (0xa6f47b loop, 0xa72c39 -> 0x4decc0), loaded from DesignationValue.pef `Set_<N>._Type` (0x4d3ad4): the title whose `set` is N.
 * The Cross order differs from the 2017 tree buttons (TREE_NODES): 35/40, 36/41, 37/42, 38/43 and 39/44 swap places. */
const nodeTitle = (n: number): number => TITLES.find((t) => t.set === n)?.id ?? 0;
/** title mark (44 images): the image follows the tree slot, not the id — the tree image N-1 (0xa7013d SetShape(i)), the picked
 * title's prDesigzationSlotImg the selected slot (0xa714b9 / 0xa72665). My Info slots use the same index [INFERIDO: their setter is
 * not decoded] */
const mark = (id: number): number => Math.max(0, (titleDef(id)?.set ?? 1) - 1);
/** alpha of a tree image: owned 255, not owned 0x4d (0xa72c10, also the init 0xa70167) */
const TREE_DIM = 0x4d / 255;

/** CEquipShapeManager textures (CreateReadyStageImageRes 0x7a5eb0): +0x30 Gui/Card/item_card.i3i, +0x34 Gui/Card/event_mission.i3i
 * (exported by pb-extract-tools export-cross-icons.mjs), +0x2c Gui/Main/UI_Source02.i3i (the pack's own atlas) */
const CARD_TEX = `${BASE}/icons/item_card.png`, EVENT_TEX = `${BASE}/icons/event_mission.png`, SOURCE02 = `${BASE}/atlas/main_ui_source02.png`;
/** a source rect the exe hands to i3GuiStatic::ChangeFirstShape(tex, u, v, w, h): the shape keeps the control's size */
type Art = readonly [url: string, u: number, v: number, w: number, h: number];
/** SetCardShape 0x7a7af0: 34x55 cards on a 39 x 60 grid from 3,3, 10 per row; set 13 = event_mission by card, else item_card row of the set */
function cardArt(setId: number, card: number): Art {
  const i = setId === EVENT_SET ? card : (setId - 1) * 10 + card;
  return [setId === EVENT_SET ? EVENT_TEX : CARD_TEX, (i % 10) * 39 + 3, Math.floor(i / 10) * 60 + 3, 34, 55];
}
/** SetCardSetShape 0x7a7c40: the 56x59 pack right of the cards (x 392), one per set row */
const setArt = (setId: number): Art => setId === EVENT_SET ? [EVENT_TEX, 392, 1, 56, 59] : [CARD_TEX, 392, (setId - 1) * 60 + 1, 56, 59];
/** badge by kind 0 ribbon / 1 ensign / 2 medal / 3 master: SetRibbonShape 0x7a7d40, SetEnsignShape 0x7a7db0, SetMedalShape 0x7a7e20
 * (index 1 -> 258,447, index 0x13 -> 306,447; every caller passes 1 or 0x13) */
const BADGE_ART: readonly Art[] = [[SOURCE02, 166, 460, 46, 15], [SOURCE02, 214, 447, 52, 47], [SOURCE02, 258, 447, 52, 47], [SOURCE02, 306, 447, 52, 47]];
/** ribbons / ensigns Info+ counts per set: the exe's own table (CardInfo 0xa9e0f1, [type, id] per card, a card counts when id != 0;
 * 0xa9ee2e loop), sets not listed have none */
const INFO_BADGES: Readonly<Record<number, readonly [number, number]>> = { 1: [10, 0], 5: [0, 8], 6: [0, 8], 7: [0, 8], 10: [0, 10] };
/** prCslotState colours of UpdateNotices 0xa761f0 (open / done) */
const NOTICE_COLOR = ["rgb(253,213,149)", "rgb(115,232,249)"];
/** set list colours of the 2017 Lua AddElement (owned / tutorial not owned / other) */
const LIST_COLOR = ["#ffd303", "#9b9b9b", "#ffffff"];
/** rows of prCardTypePopup [INFERIDO: row height] */
const ROW_H = 18;

export class ProfilePage {
  private gui: I3Gui;
  private repaints: (() => void)[] = [];
  private titlePanel!: HTMLElement;
  private titleButtons: HTMLButtonElement[] = [];
  private titlePanelName!: HTMLElement;
  private titlePanelInfo!: HTMLElement;
  private titlePanelEffects!: HTMLElement;
  private titlePanelNeeds!: HTMLElement;
  private titlePanelAction!: HTMLButtonElement;
  private titlePanelSlots: HTMLButtonElement[] = [];
  private missionPanel!: HTMLElement;
  private missionSetSelect!: HTMLSelectElement;
  private missionCards: HTMLButtonElement[] = [];
  private missionTasks!: HTMLElement;
  private missionReward!: HTMLElement;
  private missionInfo!: HTMLButtonElement;
  private missionBuy!: HTMLButtonElement;
  private missionDelete!: HTMLButtonElement;
  /** prCardTypePopup (the card set list) is open */
  private drop = false;
  private rows: HTMLElement[] = [];

  static async create(ctx: PageCtx): Promise<ProfilePage> {
    return new ProfilePage(ctx, (await loadPack("UI_Project_Profile")).root);
  }

  private constructor(private ctx: PageCtx, root: GNode) {
    const gui = (this.gui = pageGui(ctx, TEXTS));
    buildWindows(gui, ctx, root, WINDOWS);
    for (const n of HIDDEN) gui.hide(n);
    const azLabels: Record<string, string> = {
      Designation_Tree_Category_Key: "Ünvan ağacı",
      prDesigzationPlusEffectKey: "Müsbət effekt:",
      prDesigzationMinusEffectKey: "Mənfi effekt:",
      prDesigzationAddEffectKey: "Əlavə effekt:",
      prDesigzationGetInfoNameKey: "Məlumat",
      prNeedDesigzationKey: "Tələb olunan ünvan:",
      prNeedRankKey: "Tələb olunan rütbə:",
      prDesigzationMyInfoBG_Text: "Mənim məlumatım",
      prDesigzationMyInfo_DesignationKey: "Ünvan",
    };
    for (const [name, label] of Object.entries(azLabels)) gui.setText(name, label);
    const azBakedButtons: Record<string, string> = {
      prChallengeTab: "MİSSİYA",
      prRibbonTab: "MEDAL",
      prDesignationTab: "ÜNVAN",
      prLeave: "ÇIX",
    };
    for (const [name, label] of Object.entries(azBakedButtons)) {
      gui.setText(name, label);
      const text = gui.get(name)?.el.querySelector<HTMLElement>(":scope > .op-text");
      if (!text) continue;
      Object.assign(text.style, {
        background: "linear-gradient(180deg, #2b4058, #182536)",
        border: "1px solid #466784",
        color: "#b9d6ea",
        fontSize: "12px",
        fontWeight: "700",
        textShadow: "0 1px 1px #000",
      });
    }
    this.buildTitlePanel();
    this.buildMissionPanel();
    // the title's 4 required-badge images, set once at init (0xa6f940..0xa6f98b): ribbon, ensign, medal(1), master(0x13)
    BADGE_ART.forEach((a, i) => this.art(`prDesignation_NeedBadgeImage${i}`, a));
    const c = ctx.ctl;
    for (let n = 1; n <= TREE_SLOTS; n++) {
      const id = nodeTitle(n);
      onClick(gui, `Designation_Tree_Slot${n}`, () => c.click("hit", `node:${id}`));
    }
    for (let i = 0; i < TITLE_SLOTS; i++) onClick(gui, `prDesigzationMyInfo_Slot${i + 1}`, () => c.click("hit", `slot${i}`), () => c.dblclick("hit", `slot${i}`));
    this.repaints.push(gui.button("prDesigzationGetButton", () => c.click("designation", "i3UIButtonConfirm"), () => confirmMode({ state: this.state(), selected: c.profile.selected }) !== "none" && !c.profile.busy));
    gui.button("prLeave", () => c.click("main", MAIN_BUTTONS.back));
    // the frame's tabs (ChangeTab 0x869260 / 0x869300)
    onClick(gui, "prChallengeTab", () => { this.drop = false; c.click("profile", "i3UIButton_MIM"); });
    onClick(gui, "prDesignationTab", () => { this.drop = false; c.click("profile", "i3UIButton0_MID"); });
    // Missão: set combo (prCardTypeButton 0xa75a00 fills prCardTypePopup with the set names), cards, buttons, popups
    gui.button("prCardTypeButton", () => { this.drop = !this.drop; c.draw(); }, () => !c.mission.busy && !c.mission.popup);
    this.rows = this.popupRows("prCardTypePopup", (i) => this.pickSet(i));
    for (let i = 0; i < CARDS_PER_SET; i++) onClick(gui, `prCardSlot${i + 1}`, () => c.click("hit", `mcard:${i}`));
    const btn = () => buttonState(this.missionState(), c.mission.sel);
    const free = () => !c.mission.busy && !!missionSet(c.mission.sel);
    this.repaints.push(
      gui.button("prCardInfo", () => c.click("missioncard", "i3UIButton3_MIM"), () => free() && btn().info),
      gui.button("prCardBuyAll", () => c.click("missioncard", "i3UIButton4_MIM"), () => free() && btn().buy),
      gui.button("prCardDeleteAll", () => c.click("missioncard", "i3UIButton5_MIM"), () => !c.mission.busy && btn().del),
      gui.button("prCardShopConfirm", () => c.click("mbuy", "i3UIButtonComposed310"), () => !c.mission.busy && this.balance() >= 0),
      gui.button("prCardShopCancel", () => c.click("mbuy", "i3UIButtonComposed313"), () => !c.mission.busy),
    );
    gui.button("prciConfirm", () => c.click("mdetail", "Button_Close"));
    gui.button("prCardComplateConfirm", () => c.click("mdone", "i3UIButtonOK"));
    for (let i = 1; i <= TASKS_PER_CARD; i++) this.wrap(`prCslotNotice${i}`);
    this.wrap("prCardShopNotice");
    this.wrap("prCardComplateDescription");
  }

  private state() { return this.ctx.ctl.titles?.state ?? emptyTitleState(); }
  private missionState() { return this.ctx.ctl.missions?.state ?? emptyMissionState(); }

  /** The exported Cross title tree contains several legacy frames at the same coordinates.
   * Keep the protocol/controller intact, but render the title workflow in one clean responsive panel. */
  private buildTitlePanel(): void {
    const host = this.gui.get("prProfileWin")?.el;
    if (!host) return;
    const panel = document.createElement("section");
    panel.className = "az-title-panel";
    panel.style.cssText = `position:absolute;left:10px;top:78px;width:541px;height:500px;z-index:50;box-sizing:border-box;
      display:grid;grid-template-columns:314px 1fr;grid-template-rows:1fr 86px;gap:8px;padding:9px;
      color:#d6d9dc;background:rgba(27,30,33,.98);border:1px solid #435666;box-shadow:inset 0 0 20px rgba(0,0,0,.42);
      font:11px ${TEXT_FONT};pointer-events:auto;`;

    const list = document.createElement("div");
    list.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:38px;gap:4px;overflow-y:auto;padding-right:4px;align-content:start;";
    for (const def of TITLES) {
      const b = document.createElement("button");
      b.type = "button";
      b.title = titleName(def);
      b.style.cssText = "padding:2px 3px;overflow:hidden;border:1px solid #465563;border-radius:2px;background:linear-gradient(#3d4246,#25282b);color:#c8cdd1;font:10px Arial;cursor:pointer;line-height:12px;";
      b.addEventListener("click", () => this.ctx.ctl.click("hit", `node:${def.id}`));
      list.appendChild(b);
      this.titleButtons.push(b);
    }

    const detail = document.createElement("div");
    detail.style.cssText = "display:flex;min-width:0;flex-direction:column;border:1px solid #435666;background:rgba(32,36,39,.97);padding:9px;overflow:hidden;";
    this.titlePanelName = document.createElement("strong");
    this.titlePanelName.style.cssText = "font-size:14px;color:#e5c66d;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    this.titlePanelInfo = document.createElement("div");
    this.titlePanelInfo.style.cssText = "min-height:28px;color:#aebdca;line-height:14px;white-space:pre-line;";
    this.titlePanelEffects = document.createElement("div");
    this.titlePanelEffects.style.cssText = "margin-top:7px;line-height:15px;white-space:pre-line;color:#c8d8e6;";
    this.titlePanelNeeds = document.createElement("div");
    this.titlePanelNeeds.style.cssText = "margin-top:auto;padding-top:7px;border-top:1px solid #435666;line-height:15px;color:#d8c98f;white-space:pre-line;";
    this.titlePanelAction = document.createElement("button");
    this.titlePanelAction.type = "button";
    this.titlePanelAction.style.cssText = "height:28px;margin-top:7px;border:1px solid #8b7a45;background:linear-gradient(#8a773b,#4a3e20);color:white;font-weight:bold;cursor:pointer;";
    this.titlePanelAction.addEventListener("click", () => this.ctx.ctl.click("designation", "i3UIButtonConfirm"));
    detail.append(this.titlePanelName, this.titlePanelInfo, this.titlePanelEffects, this.titlePanelNeeds, this.titlePanelAction);

    const slots = document.createElement("div");
    slots.style.cssText = "grid-column:1 / 3;display:grid;grid-template-columns:105px repeat(3,1fr);gap:6px;align-items:stretch;border-top:1px solid #435666;padding-top:7px;";
    const who = document.createElement("div");
    who.style.cssText = "display:flex;align-items:center;justify-content:center;text-align:center;color:#e5c66d;font-weight:bold;white-space:pre-line;";
    who.textContent = "MƏNİM\nÜNVANLARIM";
    slots.appendChild(who);
    for (let i = 0; i < TITLE_SLOTS; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.style.cssText = "border:1px solid #465563;background:linear-gradient(#41464a,#272a2d);color:#d5d8da;font:11px Arial;cursor:pointer;white-space:pre-line;overflow:hidden;";
      b.addEventListener("click", () => this.ctx.ctl.click("hit", `slot${i}`));
      b.addEventListener("dblclick", () => this.ctx.ctl.dblclick("hit", `slot${i}`));
      slots.appendChild(b);
      this.titlePanelSlots.push(b);
    }
    panel.append(list, detail, slots);
    host.appendChild(panel);
    this.titlePanel = panel;
  }

  /** Clean mission-card view; the exported scene contains overlapping legacy frames at narrow aspect ratios. */
  private buildMissionPanel(): void {
    const host = this.gui.get("prProfileWin")?.el;
    if (!host) return;
    const panel = document.createElement("section");
    panel.style.cssText = `position:absolute;left:10px;right:10px;top:78px;height:500px;z-index:50;box-sizing:border-box;
      display:grid;grid-template-columns:minmax(0,1.45fr) minmax(210px,.75fr);grid-template-rows:auto 82px 1fr;gap:9px;padding:11px;
      color:#d6d9dc;background:rgba(27,30,33,.98);border:1px solid #435666;box-shadow:inset 0 0 22px rgba(0,0,0,.44);font:11px ${TEXT_FONT};`;
    const top = document.createElement("div");
    top.style.cssText = "grid-column:1/3;display:flex;gap:8px;align-items:center;border-bottom:1px solid #435666;padding-bottom:9px;";
    const label = document.createElement("strong"); label.textContent = "MİSSİYA KARTI"; label.style.color = "#e5c66d";
    const select = (this.missionSetSelect = document.createElement("select"));
    select.style.cssText = "flex:1;height:30px;border:1px solid #465b6d;background:#202428;color:#e1e3e5;padding:0 9px;";
    select.addEventListener("change", () => this.pickSet(select.selectedIndex));
    top.append(label, select);
    const cards = document.createElement("div");
    cards.style.cssText = "grid-column:1/3;display:grid;grid-template-columns:repeat(10,minmax(34px,1fr));gap:5px;";
    for (let i = 0; i < CARDS_PER_SET; i++) {
      const b = document.createElement("button"); b.type = "button"; b.textContent = String(i + 1);
      b.style.cssText = "min-width:0;border:1px solid #465563;background:linear-gradient(#44494d,#292c2f);color:#ddd;font-weight:bold;cursor:pointer;";
      b.onclick = () => this.ctx.ctl.click("hit", `mcard:${i}`); cards.appendChild(b); this.missionCards.push(b);
    }
    const tasks = (this.missionTasks = document.createElement("div"));
    tasks.style.cssText = "overflow:auto;border:1px solid #435666;background:#202326;padding:10px;line-height:20px;white-space:pre-line;";
    const right = document.createElement("div"); right.style.cssText = "display:flex;flex-direction:column;gap:8px;";
    const reward = (this.missionReward = document.createElement("div"));
    reward.style.cssText = "flex:1;border:1px solid #435666;background:#23272a;padding:10px;line-height:18px;white-space:pre-line;color:#d9cfad;";
    const actions = document.createElement("div"); actions.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:5px;";
    const action = (text: string, fn: () => void) => { const b=document.createElement("button"); b.type="button"; b.textContent=text; b.style.cssText="height:30px;border:1px solid #59646c;background:linear-gradient(#55595c,#303336);color:#eee;font-weight:bold;cursor:pointer;"; b.onclick=fn; actions.appendChild(b); return b; };
    this.missionInfo = action("MƏLUMAT", () => this.ctx.ctl.click("missioncard", "i3UIButton3_MIM"));
    this.missionBuy = action("AL", () => this.ctx.ctl.click("missioncard", "i3UIButton4_MIM"));
    this.missionDelete = action("SİL", () => this.ctx.ctl.click("missioncard", "i3UIButton5_MIM"));
    right.append(reward, actions); panel.append(top, cards, tasks, right); host.appendChild(panel); this.missionPanel = panel;
  }

  /** every set of every sub-tab, in the combo's order */
  private allSets(): { tab: number; id: number }[] {
    const st = this.missionState();
    return MISSION_TABS.flatMap((_, tab) => tabSets(st, tab).map((id) => ({ tab, id })));
  }

  /** a combo row: the controller's sub-tab, then its "msets" row (pickMissionSet: an owned set becomes the active one) */
  private pickSet(row: number): void {
    const c = this.ctx.ctl, pick = this.allSets()[row];
    this.drop = false;
    if (!pick) return c.draw();
    if (pick.tab !== c.mission.tab) c.click("profile", MISSION_TABS[pick.tab].btn);
    c.listSelect("msets", tabSets(this.missionState(), pick.tab).indexOf(pick.id));
    c.draw();
  }

  private balance(): number {
    const set = missionSet(this.ctx.ctl.mission.popup?.setId ?? 0);
    return set ? (this.ctx.ctl.session?.player.state.wallet?.gold ?? 0) - set.price : -1;
  }

  /**
   * The lobby background intentionally stretches from 4:3 to 16:9, but the dense title tree becomes unreadable when
   * stretched horizontally. Counter-scale only the designation window and keep its right edge anchored in place.
   */
  private fitDesignation(active: boolean): void {
    const win = this.gui.get("prProfileWin")?.el;
    const design = this.ctx.layer.parentElement;
    if (!win || !design) return;
    if (!active) {
      win.style.transform = "";
      win.style.transformOrigin = "";
      return;
    }
    const r = design.getBoundingClientRect();
    const xScale = r.width / 1024, yScale = r.height / 768;
    const ratio = xScale > 0 ? Math.min(1, yScale / xScale) : 1;
    win.style.transformOrigin = "100% 0";
    win.style.transform = `scaleX(${ratio})`;
  }

  /** a multi-line text box (the task notices / popup notes) */
  private wrap(name: string): void {
    this.gui.setText(name, this.gui.get(name)?.el.querySelector(".op-text")?.textContent ?? "");
    const t = this.gui.get(name)?.el.querySelector<HTMLElement>(":scope > .op-text");
    if (t) Object.assign(t.style, { whiteSpace: "pre-line", lineHeight: "14px", paddingTop: "4px", overflow: "hidden" });
  }

  /** text rows inside a PopupList frame, `onPick(row)` on click */
  private popupRows(name: string, onPick: (i: number) => void): HTMLElement[] {
    const b = this.gui.get(name);
    if (!b) return [];
    b.el.style.pointerEvents = "auto";
    return Array.from({ length: Math.floor((b.node.h - 8) / ROW_H) }, (_, i) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;left:6px;top:${4 + i * ROW_H}px;width:${b.node.w - 12}px;height:${ROW_H}px;line-height:${ROW_H}px;overflow:hidden;white-space:nowrap;cursor:pointer;`
        + `font:bold 11px ${TEXT_FONT};text-shadow:1px 1px 0 rgba(0,0,0,.8);`;
      d.addEventListener("click", (e) => { e.stopPropagation(); onPick(i); });
      b.el.appendChild(d);
      return d;
    });
  }

  /** the card / badge art the exe puts in a Null dummy (ChangeFirstShape): the source rect stretched to the control; null = none */
  private art(name: string, a: Art | null, alpha = 1): void {
    const b = this.gui.get(name);
    if (!b) return;
    let d = b.el.querySelector<HTMLElement>(":scope > .cx-art");
    if (!d) {
      d = document.createElement("div");
      d.className = "cx-art";
      d.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;transform-origin:0 0;";
      b.el.appendChild(d);
    }
    d.style.display = a ? "" : "none";
    d.style.opacity = String(alpha);
    if (!a) return;
    const [url, u, v, w, h] = a;
    Object.assign(d.style, { width: `${w}px`, height: `${h}px`, background: `url(${url}) ${-u}px ${-v}px no-repeat`, transform: `scale(${b.node.w / w},${b.node.h / h})` });
  }

  paint(): void {
    const c = this.ctx.ctl, gui = this.gui;
    const prof = c.page === "profile" && !!c.titles, mission = prof && c.profileTab === "mission" && !!c.missions;
    const on = prof && (c.profileTab === "designation" || mission);
    this.fitDesignation(on);
    gui.show("prProfileWin", on);
    if (!on) this.drop = false;
    this.paintComplete();
    gui.show("prCardShopWin", mission && c.mission.popup?.kind === "buy");
    gui.show("prCardInfoWin", mission && c.mission.popup?.kind === "detail");
    if (!on) return;
    // ChangeTab 0x869470: the challenge tab titles the frame, the designation tab leaves it empty
    gui.setText("prProfileCaption", mission ? this.ctx.str("STR_TBL_PROFILE_CHALLENGE_CARD_TEXT1", "Missões") : "");
    setTab(gui, "prChallengeTab", mission);
    setTab(gui, "prDesignationTab", !mission);
    gui.show("prChallengeSect", false);
    // The original designation export has duplicate legacy frames. The clean panel below replaces it.
    gui.show("prDesigzationSect", false);
    if (this.titlePanel) this.titlePanel.style.display = mission ? "none" : "grid";
    if (this.missionPanel) this.missionPanel.style.display = mission ? "grid" : "none";
    if (mission) { this.paintMission(); this.paintMissionPanel(); }
    else this.paintDesignation();
    for (const f of this.repaints) f();
  }

  private paintDesignation(): void {
    const c = this.ctx.ctl, gui = this.gui;
    const st = this.state(), sel = c.profile.selected, def = titleDef(sel), chrome = c.chrome();
    for (let n = 1; n <= TREE_SLOTS; n++) {
      const id = nodeTitle(n);
      gui.setState(`Designation_Tree_Slot${n}`, id === sel ? 2 : 0);
      gui.setState(`Designation_Tree_Slot_Image${n}`, n - 1);
      const img = gui.get(`Designation_Tree_Slot_Image${n}`);
      if (img) img.el.style.opacity = hasTitle(st, id) ? "1" : String(TREE_DIM);
    }
    // info of the picked title
    gui.show("prDesigzationSlotImg", !!def);
    if (def) gui.setState("prDesigzationSlotImg", mark(def.id));
    gui.setText("prDesigzationName", def ? titleName(def) : "Ünvan seçin");
    gui.setText("prDesigzationName_Info", def ? titleExplain(def) : "");
    const fx = def ? effectRows(def, (id) => itemName(id).name) : null;
    gui.setText("prDesigzationPlusEffect_Text", fx?.plus ?? "");
    gui.setText("prDesigzationMinusEffect_Text", fx?.minus ?? "");
    gui.setText("prDesigzationAddEffect_Text", fx?.add ?? "");
    const need = def ? [def.ribbon, def.ensign, def.medal, def.master] : [0, 0, 0, 0], have = [st.ribbon, st.ensign, st.medal, st.master];
    for (let i = 0; i < 4; i++) {
      gui.setText(`prDesignation_NeedAppendix${i}`, def ? ownedText(have[i]) : "");
      gui.setText(`prDesigzation_NeedCount${i}`, def ? neededText(need[i]) : "");
    }
    const req = (id: number) => { const r = titleDef(id); return r ? titleName(r) : "----"; };
    gui.setText("prNeedDesigzation_Text", def ? req(def.req1) : "");
    gui.setText("prNeedDesigzation_Text2", def ? req(def.req2) : "");
    gui.setText("prNeedRank_Text", def ? (def.rank ? rankName(def.rank) : "----") : "");
    const mode = confirmMode({ state: st, selected: sel });
    gui.setText("prDesigzationGetButton", mode === "get" ? "ƏLDƏ ET" : mode === "release" ? "ÇIXART" : "TAX");
    // My Info: nickname, rank, the 3 equip slots (locked past the unlocked count)
    gui.setText("prDesigzationMyInfo_NickName", chrome.nickname);
    // 0xa6de81: 0x4ad850(prDesigzationMyInfo_NickName, my nick, my nick colour +0x47)
    gui.setColor("prDesigzationMyInfo_NickName", nickCss(c.player?.state.invItem?.nickColor));
    // my clan's emblem (the profile's clan logo; no clan = no mark)
    const pr = c.player?.state.profile;
    paintMark(gui, "prDesigzationMyInfo_ClanMark", pr && pr.clanId ? pr.clanLogo : null);
    // the rank cell of LEVEL_ICON (SetUVPositioner 24 / 256, 0x791430), as the menu bar mbRankMark: the .gui default cell is rank 0
    gui.show("prDesigzationMyInfo_Rank", !!chrome.nickname);
    if (chrome.nickname) paintShapeIndex(gui, "prDesigzationMyInfo_Rank", chrome.rank, LEVEL_ICON.cell, LEVEL_ICON.tex);
    for (let i = 0; i < TITLE_SLOTS; i++) {
      const id = st.equiped[i] ?? 0, k = i + 1, t = titleDef(id);
      gui.show(`prDesigzationMyInfo_Slot${k}_Lock`, i >= st.slots);
      gui.show(`prDesigzationMyInfo_Slot${k}_Image`, !!t);
      if (t) gui.setState(`prDesigzationMyInfo_Slot${k}_Image`, mark(t.id));
      gui.setText(`prDesigzationMyInfo_Slot${k}_Text`, t ? titleName(t) : "");
      gui.setColor(`prDesigzationMyInfo_Slot${k}_Text`, c.profile.slotSel === i ? "#ffd24a" : "#c9ced6");
    }
    this.paintTitlePanel();
  }

  private paintTitlePanel(): void {
    if (!this.titlePanel) return;
    const c = this.ctx.ctl, st = this.state(), sel = c.profile.selected, def = titleDef(sel);
    for (let i = 0; i < TITLES.length; i++) {
      const d = TITLES[i], b = this.titleButtons[i], owned = hasTitle(st, d.id);
      b.textContent = `${d.id}. ${titleName(d)}`;
      b.style.opacity = owned ? "1" : ".58";
      b.style.color = owned ? "#9ef58b" : "#bac9d8";
      b.style.borderColor = d.id === sel ? "#4f8fbd" : "#465563";
      b.style.background = d.id === sel ? "linear-gradient(#365f7d,#203b50)" : "linear-gradient(#3d4246,#25282b)";
    }
    this.titlePanelName.textContent = def ? titleName(def) : "Ünvan seçin";
    this.titlePanelInfo.textContent = def ? titleExplain(def) : "Soldakı siyahıdan bir ünvan seçin.";
    const fx = def ? effectRows(def, (id) => itemName(id).name) : null;
    this.titlePanelEffects.textContent = def && fx
      ? `Müsbət effekt:\n${fx.plus}\n\nMənfi effekt:\n${fx.minus}\n\nƏlavə effekt:\n${fx.add}`
      : "";
    const req = (id: number) => { const r = titleDef(id); return r ? titleName(r) : "—"; };
    this.titlePanelNeeds.textContent = def
      ? `Medallar: ${st.ribbon}/${def.ribbon}  •  ${st.ensign}/${def.ensign}  •  ${st.medal}/${def.medal}  •  ${st.master}/${def.master}\nTələb olunan ünvan: ${req(def.req1)}${def.req2 ? `, ${req(def.req2)}` : ""}\nTələb olunan rütbə: ${def.rank ? rankName(def.rank) : "—"}`
      : "";
    const mode = confirmMode({ state: st, selected: sel });
    this.titlePanelAction.textContent = mode === "get" ? "ƏLDƏ ET" : mode === "release" ? "ÇIXART" : mode === "use" ? "TAX" : "ÜNVAN SEÇİN";
    this.titlePanelAction.disabled = mode === "none" || c.profile.busy;
    this.titlePanelAction.style.opacity = this.titlePanelAction.disabled ? ".45" : "1";
    for (let i = 0; i < TITLE_SLOTS; i++) {
      const id = st.equiped[i] ?? 0, locked = i >= st.slots, b = this.titlePanelSlots[i];
      b.textContent = locked ? `Yuva ${i + 1}\n🔒 Bağlıdır` : `Yuva ${i + 1}\n${id ? titleName(titleDef(id)!) : "Boş"}`;
      b.disabled = locked;
      b.style.borderColor = c.profile.slotSel === i ? "#4f8fbd" : "#465563";
      b.style.opacity = locked ? ".45" : "1";
    }
  }

  private paintMissionPanel(): void {
    if (!this.missionPanel) return;
    const c = this.ctx.ctl, st = this.missionState(), m = c.mission;
    const all = this.allSets(), set = missionSet(m.sel), slot = set ? slotOfSet(st, set.id) : -1;
    const owned = slot >= 0 ? st.slots[slot] : undefined;
    if (this.missionSetSelect.options.length !== all.length) {
      this.missionSetSelect.replaceChildren(...all.map((x) => { const o=document.createElement("option"); o.value=String(x.id); o.textContent=setName(missionSet(x.id)!); return o; }));
    }
    this.missionSetSelect.selectedIndex = Math.max(0, all.findIndex((x) => x.id === m.sel));
    for (let i = 0; i < this.missionCards.length; i++) {
      const b=this.missionCards[i], active=!!owned && owned.card===i;
      b.disabled=!set; b.style.opacity=set ? (active ? "1" : ".72") : ".3";
      b.style.borderColor=active ? "#4f8fbd" : "#465563";
      b.style.background=active ? "linear-gradient(#365f7d,#203b50)" : "linear-gradient(#44494d,#292c2f)";
    }
    const card = set && owned ? set.cards[owned.card] : undefined;
    const rows = notices(st, m.sel).filter((_, i) => !!card?.tasks[i]);
    this.missionTasks.textContent = rows.length ? rows.map((x, i) => `${x.checked ? "✓" : "○"}  ${i + 1}. ${x.text}`).join("\n") : "Aktiv missiya tapşırığı yoxdur.";
    const pz = prize(st, m.sel);
    this.missionReward.textContent = `MÜKAFAT\n\n${pz.name || "—"}\nTəcrübə: ${pz.exp}\nPoint: ${pz.gold}`;
    const state = buttonState(st, m.sel), free = !c.mission.busy && !!set;
    this.missionInfo.disabled = !(free && state.info);
    this.missionBuy.disabled = !(free && state.buy);
    this.missionDelete.disabled = !(!c.mission.busy && state.del);
    for (const b of [this.missionInfo,this.missionBuy,this.missionDelete]) b.style.opacity=b.disabled ? ".38" : "1";
  }

  private paintMission(): void {
    const c = this.ctx.ctl, gui = this.gui, m = c.mission, st = this.missionState();
    const set = missionSet(m.sel), slot = set ? slotOfSet(st, set.id) : -1, s = slot >= 0 ? st.slots[slot] : undefined;
    // the set combo and its list
    gui.setText("prCardTypeCombo", set ? setName(set) : MS.notDetected);
    gui.show("prCardTypePopup", this.drop);
    const all = this.allSets();
    this.rows.forEach((d, i) => {
      const r = all[i], t = r ? setName(missionSet(r.id)!) : "";
      if (d.textContent !== t) d.textContent = t;
      d.style.display = t ? "" : "none";
      d.style.color = r?.id === m.sel ? "#ffd24a" : LIST_COLOR[r ? setListState(st, r.id) : 2];
    });
    // the 10 cards: SetCardShape(set, i) (0xa76b3d), alpha by state (2017 0x9552b0), the active card's button selected
    for (let i = 0; i < CARDS_PER_SET; i++) {
      gui.show(`prCardSlot${i + 1}`, !!set);
      if (!set) continue;
      gui.setState(`prCardSlot${i + 1}`, s && s.card === i && slot === st.active ? 1 : 0);
      this.art(`prCard${i + 1}`, cardArt(set.id, i), cardAlpha(set, s, i) / 255);
    }
    // the shown card's tasks (UpdateNotices 0xa761f0): the card's quests fill the rows in order, each row's prCslotState says
    // "Missão" / "Feito" in its colour, the rows past the last quest are emptied. Every prCslot gets setControlState(8)
    // (0xa76266 / 0xa76422 / 0xa764ca), so the BigButton shape does not follow the task [INFERIDO: shape 0, the state -> shape
    // table of the control (i3GuiControl +0x1dc) is not in the export]
    const card = set && s ? set.cards[s.card] : undefined, tasks = notices(st, m.sel).filter((_, i) => !!card?.tasks[i]);
    for (let i = 0; i < TASKS_PER_CARD; i++) {
      const n = tasks[i], done = !!n?.checked;
      gui.setText(`prCslotNotice${i + 1}`, n?.text ?? "");
      gui.setText(`prCslotState${i + 1}`, n ? (done ? MS.complete : MS.challenge) : "");
      gui.setColor(`prCslotState${i + 1}`, NOTICE_COLOR[done ? 1 : 0]);
      gui.setState(`prCslot${i + 1}`, 0);
    }
    // prize of the shown card (OnUpdatePrize 0xa75320): the card (SetCardShape), the ribbon in prPrizeRibbonDummy, ensign / medal /
    // master in prPrizeMedalDummy (switch 0xa7550c), both hidden without a badge
    const pz = prize(st, m.sel);
    this.art("prCard", set && s ? cardArt(set.id, s.card) : null);
    gui.show("prPrizeRibbonDummy", pz.shape === 0);
    gui.show("prPrizeMedalDummy", pz.shape > 0);
    this.art("prPrizeRibbonDummy", pz.shape === 0 ? BADGE_ART[0] : null);
    this.art("prPrizeMedalDummy", pz.shape > 0 ? BADGE_ART[pz.shape] : null);
    gui.setText("prPrizeNameValue", pz.name);
    gui.setText("prPrizeExpValue", String(pz.exp));
    gui.setText("prPrizePointValue", String(pz.gold));
    gui.setText("prPrizeDescription", ""); // the pef PrizeDescription: the 2017 BR Quest.pef has none
    // popups of the tab
    const pp = m.popup, ps = pp ? missionSet(pp.setId) : undefined;
    if (pp?.kind === "buy" && ps) {
      const gold = c.session?.player.state.wallet?.gold ?? 0, bal = gold - ps.price;
      gui.setText("prCardShopName", setName(ps));
      gui.setText("prCardShopPrice", goldText(ps.price));
      gui.setText("prCardShopCurrentValue", goldText(gold));
      gui.setText("prCardShopRemainderValue", goldText(bal));
      gui.setColor("prCardShopRemainderValue", bal < 0 ? "#ff4040" : "#c9ced6"); // SetCardConfirm reddens a short balance
      this.art("prCardShopSetDummy", setArt(ps.id)); // 0xa9cbde SetCardSetShape
    }
    if (pp?.kind === "detail" && ps) {
      gui.setText("prciCardInfoCardName", setName(ps));
      gui.setText("prciCardInfoPriceValue", goldText(ps.price));
      gui.setText("prciCardInfoPointValue", goldText(ps.totalPoint));
      gui.setText("prciCardInfoExpValue", expText(ps.totalExp));
      this.art("prciCardInfoCardImage", setArt(ps.id)); // 0xa9df9e SetCardSetShape
      // badges the set pays (0xa9eecf..): "%d %s" with STBL_IDX_ITEM_COUNT_UNIT; ribbons / ensigns from the exe's per-set table, medals /
      // masters from the card-set getters 0x9b0e50 / 0x9b0e20 [INFERIDO: those two read as the cards' medal badges and the set's
      // bonus master + master badges]
      const unit = this.ctx.str("STBL_IDX_ITEM_COUNT_UNIT", ""), table = INFO_BADGES[ps.id];
      for (let k = 0; k < 4; k++) {
        const n = k < 2 ? table?.[k] ?? 0 : ps.cards.filter((cd) => badgeType(cd.badge) === k).length + (k === 3 ? ps.bonusMaster : 0);
        gui.setText(`prciSupplyMedalName${k}`, k === 3 ? MS.master : badgeName(k));
        gui.setText(`prciSupplyMedalCount${k}`, unit ? `${n} ${unit}` : String(n));
        this.art(k === 0 ? "prciSupplyMedalRibbonImage0" : `prciSupplyMedalMedalImage${k}`, BADGE_ART[k]);
      }
      gui.setText("prciFinalPrizePointTextValue", goldText(ps.bonusPoint));
      gui.setText("prciFinalPrizeExpTextValue", expText(ps.bonusExp));
      const fp = detailPrize(ps.id, pp.item ?? 0).prize;
      gui.setText("prciFinalPrizeItemTextValue", fp?.name ?? "");
      setIcon(gui, "prciFinalPrizeItemImage", fp?.webId ?? 0);
    }
  }

  /** prCardComplateWin over any page while the controller holds a finished card / set (2361, completeInfo); in the room the room's own windows take it (app.ts roomDone) */
  private paintComplete(): void {
    const c = this.ctx.ctl, gui = this.gui, d = c.missionDone;
    gui.show("prCardComplateWin", !!d && c.page !== "room");
    if (!d) return;
    gui.setText("prCardComplateName", `${d.exp}   ${d.point}`);
    gui.setText("prCardComplateDescription", d.items.length ? this.ctx.str("STR_TBL_PROFILE_REWARD_ITEM_MESSAGE", "").replace(/\{col:[^}]*\}|\{\/col\}/g, "").replace(/\\n/g, "\n") : "");
    setIcon(gui, "prCardComplateDummy", d.items[0] ?? 0);
  }
}
