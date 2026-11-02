// Asset root of the Cross battle HUD art: public/assets/ui/cross-hud (tools ui-export/cross-hud.mjs: Gui/Ingame, Gui/Hud and
// Gui/Interface sheets of PBCross, Weapon_Kill pages, Tab minimaps). Positions come from the Cross exe,
// never from a V12 / 3.123 scene.
import { UI_BASE } from "../../lobby/ui/assets.ts";

export const CROSS_HUD = `${UI_BASE}/cross-hud`;
/** Classic 4Game battle HUD atlas exported from UI_Project_HUD. */
export const CLASSIC_HUD = `${UI_BASE}/cross/atlas/ingame_hud.png?v=old4game-2`;
/** Hud.png / Hud2.png use the classic 4Game atlases; remaining special sheets stay in cross-hud. */
export const hudTexture = (name: string): string => name === "Hud.png"
  ? CLASSIC_HUD
  : name === "Hud2.png"
    ? `${CROSS_HUD}/hud/Hud2_old4game.png?v=old4game-2`
    : `${CROSS_HUD}/hud/${name}`;
