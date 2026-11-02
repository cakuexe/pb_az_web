import { registerAccount, loginAccount, tokenToBytes, AccountApiError } from "../net/accountApi.js";
import { Stage } from "../lobby/ui/LayoutRenderer.ts";

export interface AccountSession {
  token: Uint8Array;
  username: string;
}

const STYLE_ID = "pb-account-screen-style";
const LOGIN_ART = "/assets/ui/cross/brand/login-page.jpg";
const LOGIN_BGM = "/assets/sfx/cross/pb_lobby.mp3";

// Compact classic login panel, positioned between the two characters on the 1024 x 768 design stage.
const ID_RECT = "left:437px;top:514px;width:136px;height:28px";
const PW_RECT = "left:437px;top:550px;width:136px;height:28px";

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .pb-account-overlay { position: fixed; inset: 0; z-index: 10000; background: #000; }
    .pb-account-art { background: #000 url(${LOGIN_ART}) center / 1024px 768px no-repeat; }
    .pb-account-panel {
      position:absolute;left:367px;top:496px;width:226px;height:132px;box-sizing:border-box;
      border:1px solid #05090c;border-radius:7px;
      background:linear-gradient(180deg,rgba(30,35,40,.98) 0%,rgba(17,21,25,.98) 72%,rgba(22,27,32,.98) 100%);
      box-shadow:0 0 0 2px #242c33,0 0 0 3px rgba(0,0,0,.92),inset 0 1px rgba(125,135,142,.25),0 3px 8px rgba(0,0,0,.8);
    }
    .pb-account-input {
      position: absolute; box-sizing: border-box; margin: 0; padding: 0 6px; border: 0; outline: 0;
      background:linear-gradient(#d4d4d4,#b9bbbc);color:#171717;caret-color:#111;font:12px Arial,sans-serif;
      border:1px solid #52575b;box-shadow:inset 1px 1px 2px rgba(0,0,0,.62),0 1px rgba(255,255,255,.08);border-radius:1px;
    }
    /* browser autofill paints its own light background and dark text over the baked field: keep the field transparent */
    .pb-account-input:-webkit-autofill, .pb-account-input:-webkit-autofill:hover, .pb-account-input:-webkit-autofill:focus {
      -webkit-text-fill-color:#161616;caret-color:#111;transition:background-color 600000s 0s,color 600000s 0s;
    }
    .pb-account-input:autofill { background: transparent; }
    .pb-account-btn {
      position: absolute; box-sizing: border-box; margin: 0; padding: 0; border: 1px solid #4a4a4a; border-radius: 2px;
      background:linear-gradient(#4d5256,#24282b 52%,#171a1d);color:#d8dadd;font:11px Arial,sans-serif;letter-spacing:0;cursor:pointer;
      box-shadow:inset 0 1px rgba(255,255,255,.16),0 1px 2px #000;
    }
    .pb-account-btn:hover { border-color: #7a7a7a; color: #ddd; }
    .pb-account-btn.active { color:#f2f2f2;border-color:#51575c;background:linear-gradient(#555b60,#292d30 52%,#181b1d); }
    .pb-account-btn:disabled { opacity: 0.5; cursor: default; }
    .pb-account-error {
      position:absolute;left:262px;top:684px;width:500px;display:none;text-align:center;
      font: 12px Arial, sans-serif; color: #ff9d9d; text-shadow: 0 1px 2px #000; white-space: nowrap;
    }
    .pb-account-error.visible { display: block; }
    .pb-account-label {
      position: absolute; box-sizing: border-box; display: flex; align-items: center;
      color:#d7d9dc;font:11px Arial,sans-serif;text-shadow:0 1px 2px #000;
    }
    .pb-account-remember{position:absolute;left:374px;top:601px;color:#d9dcdf;font:10px Arial,sans-serif;text-shadow:0 1px #000;display:flex;align-items:center;gap:6px}
    .pb-account-remember input{margin:0;accent-color:#278f9f;width:13px;height:13px}
  `;
  document.head.appendChild(style);
}

export function showAccountScreen(): Promise<AccountSession> {
  ensureStyles();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "pb-account-overlay";
    document.body.appendChild(overlay);

    // the Cross login is an i3Gui window on the 1024 x 768 stage: same fit as the lobby (app.ts)
    const stage = new Stage(overlay, 1024, 768, true);
    stage.design.classList.add("pb-account-art");
    stage.design.innerHTML = `
      <div class="pb-account-panel"></div>
      <div class="pb-account-label" style="left:390px;top:514px;width:46px;height:28px">İst. adı</div>
      <div class="pb-account-label" style="left:390px;top:550px;width:46px;height:28px">Şifrə</div>
      <input class="pb-account-input" id="pb-acc-username" type="text" autocomplete="username" maxlength="16" style="${ID_RECT}" />
      <input class="pb-account-input" id="pb-acc-password" type="password" autocomplete="current-password" maxlength="64" style="${PW_RECT}" />
      <label class="pb-account-remember"><input id="pb-acc-remember" type="checkbox"> İstifadəçi adını yadda saxla</label>
      <button class="pb-account-btn" id="pb-acc-mode" type="button" style="left:397px;top:641px;width:80px;height:27px">QEYDİYYAT</button>
      <button class="pb-account-btn active" id="pb-acc-submit" type="button" style="left:493px;top:641px;width:74px;height:27px">DAXİL OL</button>
      <div class="pb-account-error" id="pb-acc-error"></div>
    `;

    const bgm = new Audio(LOGIN_BGM);
    bgm.loop = true;
    bgm.volume = 0.6;
    const startBgm = () => { void bgm.play().catch(() => {}); };
    void bgm.play().catch(() => {
      document.addEventListener("pointerdown", startBgm, { once: true });
      document.addEventListener("keydown", startBgm, { once: true });
    });

    let mode: "login" | "register" = "login";
    const modeBtn = stage.design.querySelector<HTMLButtonElement>("#pb-acc-mode")!;
    const submitBtn = stage.design.querySelector<HTMLButtonElement>("#pb-acc-submit")!;
    const usernameInput = stage.design.querySelector<HTMLInputElement>("#pb-acc-username")!;
    const passwordInput = stage.design.querySelector<HTMLInputElement>("#pb-acc-password")!;
    const rememberInput = stage.design.querySelector<HTMLInputElement>("#pb-acc-remember")!;
    const errorBox = stage.design.querySelector<HTMLElement>("#pb-acc-error")!;
    const remembered = localStorage.getItem("pb.rememberedUsername") ?? "";
    usernameInput.value = remembered;
    rememberInput.checked = !!remembered;

    // [RECRIADO] the original LOGIN box has no register mode: the submit button and the CADASTRAR / VOLTAR switch are ours
    function setMode(next: "login" | "register"): void {
      mode = next;
      modeBtn.textContent = next === "login" ? "QEYDİYYAT" : "GERİ";
      submitBtn.textContent = next === "login" ? "DAXİL OL" : "HESAB YARAT";
      passwordInput.autocomplete = next === "login" ? "current-password" : "new-password";
      hideError();
    }

    function showError(message: string): void {
      errorBox.textContent = message;
      errorBox.classList.add("visible");
    }

    function hideError(): void {
      errorBox.classList.remove("visible");
    }

    modeBtn.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

    async function submit(): Promise<void> {
      hideError();
      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!/^[a-zA-Z0-9_]{4,16}$/.test(username)) {
        showError("İstifadəçi adı 4–16 simvoldan ibarət olmalıdır (hərf, rəqəm, _)");
        return;
      }
      if (password.length < 6) {
        showError("Şifrə ən azı 6 simvol olmalıdır");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "GÖZLƏYİN...";
      try {
        const result = mode === "login"
          ? await loginAccount(username, password)
          : await registerAccount(username, password);

        if (rememberInput.checked) localStorage.setItem("pb.rememberedUsername", username);
        else localStorage.removeItem("pb.rememberedUsername");

        bgm.pause();
        document.removeEventListener("pointerdown", startBgm);
        document.removeEventListener("keydown", startBgm);
        stage.destroy();
        overlay.remove();
        resolve({ token: tokenToBytes(result.token), username: result.nickname });
      } catch (err) {
        const message = err instanceof AccountApiError ? err.message : "Hesab serverinə qoşulmaq mümkün olmadı";
        showError(message);
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "DAXİL OL" : "HESAB YARAT";
      }
    }

    submitBtn.addEventListener("click", () => void submit());
    for (const input of [usernameInput, passwordInput]) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") void submit();
      });
    }
  });
}
