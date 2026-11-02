// PT-BR texts the lobby controller (controller.ts) says or hands to the Cross shell: STBL/STR key of String_Brazil resolved
// by src/lobby/ui/i18n.ts, fallback copied verbatim from the table; key null = literal PT-BR chosen here [INFERIDO] (no BR key
// found). Same scheme as src/lobby/screens/strings.ts.
import { tOr } from "../ui/i18n.ts";
import { cleanLabel } from "../screens/strings.ts";

type Entry = readonly [key: string | null, fallback: string, multiline?: boolean];
const K = {
  // servers / channels
  full: ["STR_TBL_GUI_SERVER_STATE_FULL", "LOTADO"],
  server: [null, "Server"],
  channel: [null, "Kanal"],
  // lobby
  colMode: ["STR_TBL_GUI_READY_GAME_MODE", "Modo"],
  loadingRooms: ["STR_TBL_GUI_LOBBY_NOTICE_LOADING_ROOM_LIST", "Está carregando a lista de salas"],
  notExistRoom: ["STBL_IDX_EP_LOBBY_NOT_EXIST_ROOM", "Sala inexistente."],
  // 2017 exe 0x8f54e0 (room phase, game event 1001 from SERVER_MESSAGE_KICK_PLAYER_ACK)
  roomKicked: ["STBL_IDX_EP_ROOM_KICKED", "Foi expulso pelo dono da sala."],
  wait: ["STR_TBL_GUI_LOBBY_WAIT_STATE_TEXT", "Aguarde..."],
  // login / loading captions (the exe's own wait messages)
  loginNoServer: ["STBL_IDX_EP_LOGIN_WAIT_DISCONNECT", "Não foi possível conectar com servidor.\nTente conectar mais tarde.", true],
  loadConnect: ["STBL_IDX_EP_LOGIN_WAIT_CONNECT_W", "Conectando...\nAguarde um momento.", true],
  loadServer: ["STBL_IDX_EP_SERVER_WAIT_REFRESH_W", "Obtendo informações do servidor.\nAguarde um momento.", true],
  loadMyInfo: ["STBL_IDX_EP_SERVER_WAIT_GET_MYINFO", "Recebendo informações do usuário.\nAguarde um momento.", true],
  welcome: [null, "Xoş gəlmisiniz:"],
  // room modes (roomModes.ts ROOM_MODES[].text): Deathmatch variants of Rules.xml (Mode 19/20/21: StageOptions 96/128/224)
  deathmatch: ["STR_HEADER_MODE_TEAM_DEATH_MATCH", "Deathmatch"],
  modeSniper: ["STR_TBL_GUI_LOBBY_SNIPERMODE_TITLE", "Modo Sniper"],
  modeShotgun: ["STR_TBL_GUI_LOBBY_SHOTGUNMODE_TITLE", "Shotgun"],
  // renamed on purpose: the original BR title ("Partida Clube", STR_TBL_GUI_LOBBY_KNUCKLEMODE_TITLE) is not shown
  modeKnife: [null, "Bıçaq rejimi"],
  // AI room: server Rules.xml Mode 16 "DEATHMATCH_AIC" = Rule 0, StageOptions 2 (AI), Conditions 4
  modeBots: ["STR_TBL_GUI_LOBBY_TRANING_TEXT", "Challenge"],
  modeHeadHunter: ["STR_TBL_GUI_LOBBY_HEADHUNTERMODE_TITLE", "HeadHunter"],
  modeChaos: ["STR_TBL_GUI_LOBBY_CHAOS_TITLE", "Caos"],
  modeBomb: ["STR_HEADER_MODE_EXPLOSION", "Destruição"],
  // Bomb Mission with a special weapon: no Cross string for the variant (STBL_IDX_GAMEMODE_BOMB_SR / _SG / _KCL) [RECRIADO]
  modeBombSniper: [null, "Snayper bomba missiyası"],
  modeBombShotgun: [null, "Pompalı bomba missiyası"],
  modeBombKnife: [null, "Bıçaq bomba missiyası"],
  // Destroy (Sabotagem, STR_HEADER_MODE_DESTROY); its variants [RECRIADO] like the Bomb ones
  modeDestroy: ["STR_HEADER_MODE_DESTROY", "Sabotagem"],
  modeDefence: ["STR_HEADER_MODE_DEFENCE", "Defesa"],
  modeDestroySniper: [null, "Snayper məhvetmə"],
  modeDestroyShotgun: [null, "Pompalı məhvetmə"],
  modeDestroyKnife: [null, "Bıçaq məhvetmə"],
  // Annihilation = Rules.xml Mode 4 (Rule 0, StageOptions 1, Conditions 16); the Cross create window names it "Guerra de extermínio"
  modeAnnihilation: ["STR_TBL_GUI_LOBBY_ROUND_BATTLE_TEXT", "Guerra de extermínio"],
  // Ace = Rules.xml Mode 55 (Rule 128, Conditions 32). No Cross string for the mode name: "Ace Attacker" (tutorial text) [INFERIDO]
  modeAce: ["STR_HEADER_DO_TCH_DN_ACE_ATTACKER", "Ace Attacker"],
  minutes: [null, "dəqiqə"],
  noTrainingTeam: ["STBL_IDX_EP_ROOM_NO_TRAINIG_TEAM_S", "Todos jogadores devem escolher o mesmo time."],
  // ready room
  noChangeSlot: ["STBL_IDX_EP_ROOM_NO_CHANGE_SLOT_S", "Para trocar de time, desative o PRONTO."],
  startNeedsReady: [null, "Rəqib komandada ən azı 1 HAZIR oyunçu olmalıdır."],
  noPlayerInfo: [null, "Oyunçu məlumatını almaq mümkün olmadı."],
  // chat feedback [RECRIADO]: the exe's texts for these were not traced
  chatBlocked: [null, "Oyunçu bloklandı:"],
  chatUnblocked: [null, "Oyunçunun bloku açıldı:"],
  chatBlockList: [null, "Bloklananlar:"],
  chatBlockNone: [null, "Bloklanmış oyunçu yoxdur."],
  chatBlockUsage: [null, "/blok <ləqəb> və ya /blokac <ləqəb> istifadə edin."],
  chatNoWhisper: [null, "Siyahıdan oyunçu seçin (Şəxsi) və ya /w <ləqəb> <mətn> istifadə edin."],
  chatNoTeam: [null, "Komanda çatı yalnız otaqda işləyir."],
  chatOffline: [null, "Çat serverinə bağlantı yoxdur."],
} as const satisfies Record<string, Entry>;

type Labels = { readonly [k in keyof typeof K]: string };
export const T = {} as Labels;
for (const [name, e] of Object.entries(K) as [keyof typeof K, Entry][]) {
  Object.defineProperty(T, name, { enumerable: true, get: () => cleanLabel(e[0] ? tOr(e[0], e[1]) : e[1], e[2] === true) });
}
