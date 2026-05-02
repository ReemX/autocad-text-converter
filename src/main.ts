import "./style.css";
import { convert } from "./translator/convert.ts";
import { createDictation, getSpeechRecognition } from "./speech.ts";
import { applyTheme, loadTheme, type Theme } from "./theme.ts";

type State = {
  finalText: string;
  interimText: string;
  listening: boolean;
  theme: Theme;
};

const state: State = {
  finalText: "",
  interimText: "",
  listening: false,
  theme: loadTheme(),
};

applyTheme(state.theme);

const SVG_MIC = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3M9 21h6" />
  </svg>`;

const SVG_COPY = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="1" />
    <path d="M5 15V5a2 2 0 012-2h10" />
  </svg>`;

const SVG_CHECK = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12l4 4 10-10" />
  </svg>`;

const SVG_AUTO = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="12" rx="1.5" />
    <path d="M9 21h6M12 17v4" />
  </svg>`;

const SVG_SUN = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </svg>`;

const SVG_MOON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </svg>`;

const REG_MARKS = `
  <span class="reg reg-tl"></span>
  <span class="reg reg-tr"></span>
  <span class="reg reg-bl"></span>
  <span class="reg reg-br"></span>`;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <main class="sheet" role="main">
    <div class="theme-toggle" role="group" aria-label="ערכת נושא">
      <button data-theme-value="auto" type="button" aria-label="אוטומטי" title="אוטומטי">${SVG_AUTO}</button>
      <button data-theme-value="light" type="button" aria-label="בהיר" title="בהיר">${SVG_SUN}</button>
      <button data-theme-value="dark" type="button" aria-label="כהה" title="כהה">${SVG_MOON}</button>
    </div>

    <header class="masthead">
      <h1 class="title">ממיר טקסט · אוטוקאד</h1>
    </header>

    <section class="composer">
      <div class="pane">
        ${REG_MARKS}
        <button class="mic-btn" data-role="mic" type="button"
          aria-label="הפעל תמלול דיבור" aria-pressed="false" title="הפעל תמלול דיבור">
          ${SVG_MIC}
        </button>
        <textarea
          class="textbox"
          data-role="input-text"
          dir="rtl"
          lang="he"
          placeholder="כתוב או דבר בעברית..."
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          autofocus
        ></textarea>
      </div>

      <button class="copy-btn" data-role="copy" type="button">
        <span class="copy-icon" data-role="copy-icon">${SVG_COPY}</span>
        <span class="copy-label" data-role="copy-label">העתק</span>
      </button>
    </section>

    <footer class="status">
      <span class="status-pulse" aria-hidden="true"></span>
      <span class="status-label" data-role="status-label">מוכן</span>
      <p class="hint" data-role="hint"></p>
    </footer>
  </main>
`;

const inputEl = app.querySelector<HTMLTextAreaElement>('[data-role="input-text"]')!;
const micBtn = app.querySelector<HTMLButtonElement>('[data-role="mic"]')!;
const copyBtn = app.querySelector<HTMLButtonElement>('[data-role="copy"]')!;
const copyIcon = app.querySelector<HTMLSpanElement>('[data-role="copy-icon"]')!;
const copyLabel = app.querySelector<HTMLSpanElement>('[data-role="copy-label"]')!;
const statusLabel = app.querySelector<HTMLSpanElement>('[data-role="status-label"]')!;
const hintEl = app.querySelector<HTMLParagraphElement>('[data-role="hint"]')!;
const themeButtons = Array.from(
  app.querySelectorAll<HTMLButtonElement>("[data-theme-value]"),
);

let recognition: ReturnType<typeof createDictation> = null;
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

function syncThemeButtons() {
  for (const b of themeButtons) {
    const value = b.dataset.themeValue as Theme;
    b.setAttribute("aria-pressed", String(value === state.theme));
  }
}

function render() {
  const combined = state.finalText + state.interimText;
  if (inputEl.value !== combined) inputEl.value = combined;
  copyBtn.disabled = combined.trim().length === 0;
}

function setStatus(label: string, hint = "", isError = false) {
  statusLabel.textContent = label;
  hintEl.textContent = hint;
  hintEl.classList.toggle("error", isError);
}

for (const b of themeButtons) {
  b.addEventListener("click", () => {
    state.theme = b.dataset.themeValue as Theme;
    applyTheme(state.theme);
    syncThemeButtons();
  });
}

inputEl.addEventListener("input", () => {
  state.finalText = inputEl.value;
  state.interimText = "";
  render();
});

copyBtn.addEventListener("click", async () => {
  const source = state.finalText + state.interimText;
  if (!source) return;
  try {
    await navigator.clipboard.writeText(convert(source));
    copyBtn.classList.add("copied");
    copyIcon.innerHTML = SVG_CHECK;
    copyLabel.textContent = "הועתק";
    if (copyResetTimer) clearTimeout(copyResetTimer);
    copyResetTimer = setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyIcon.innerHTML = SVG_COPY;
      copyLabel.textContent = "העתק";
    }, 1400);
  } catch {
    setStatus("שגיאה", "ההעתקה נכשלה. נסה שוב.", true);
  }
});

micBtn.addEventListener("click", () => {
  if (state.listening) stopDictation();
  else startDictation();
});

const ERROR_HE: Record<string, string> = {
  "not-allowed": "אין הרשאה למיקרופון. אפשר במערכת/דפדפן.",
  "service-not-allowed": "שירות התמלול חסום בדפדפן.",
  "audio-capture": "אין מיקרופון זמין או שהוא בשימוש באפליקציה אחרת.",
  "no-speech": "לא זוהה דיבור.",
  network: "תקלת רשת זמנית בשירות התמלול. בדוק חיבור ונסה שוב.",
  "language-not-supported": "השפה אינה נתמכת.",
  aborted: "התמלול הופסק.",
};

let lastErrored = false;
let networkRetries = 0;
let shouldRecreate = false;
const MAX_NETWORK_RETRIES = 8;

function buildRecognition() {
  return createDictation("he-IL", {
    onAudioStart: () => {
      micBtn.classList.add("ready");
      setStatus("מקשיב");
    },
    onFinal: (text) => {
      const sep = state.finalText && !state.finalText.endsWith(" ") ? " " : "";
      state.finalText = state.finalText + sep + text.trim() + " ";
      state.interimText = "";
      networkRetries = 0;
      render();
    },
    onInterim: (text) => {
      state.interimText = text;
      networkRetries = 0;
      render();
    },
    onError: (error) => {
      console.error("[speech]", error);
      if (error === "network" && networkRetries < MAX_NETWORK_RETRIES && state.listening) {
        networkRetries++;
        shouldRecreate = true;
        micBtn.classList.remove("ready");
        setStatus("מתכונן…", "המתן עד שהמיקרופון יתחיל להאזין.");
        return;
      }
      if (error === "no-speech" && state.listening) {
        return;
      }
      lastErrored = true;
      const message = ERROR_HE[error] ?? `שגיאת מיקרופון: ${error}`;
      state.listening = false;
      micBtn.setAttribute("aria-pressed", "false");
      micBtn.classList.remove("listening");
      setStatus("שגיאה", message, true);
    },
    onEnd: () => {
      if (state.listening && !lastErrored) {
        if (shouldRecreate) {
          shouldRecreate = false;
          recognition = buildRecognition();
          if (recognition) {
            try {
              recognition.start();
              return;
            } catch {
              // fall through
            }
          }
        } else {
          try {
            recognition?.start();
            return;
          } catch {
            // fall through
          }
        }
      }
      state.listening = false;
      micBtn.setAttribute("aria-pressed", "false");
      micBtn.classList.remove("listening");
      if (!lastErrored) setStatus("מוכן");
    },
  });
}

function startDictation() {
  lastErrored = false;
  networkRetries = 0;
  shouldRecreate = false;
  recognition = buildRecognition();
  if (!recognition) {
    setStatus("לא זמין", "תמלול דיבור אינו זמין בדפדפן זה.", true);
    return;
  }
  recognition.start();
  state.listening = true;
  micBtn.setAttribute("aria-pressed", "true");
  micBtn.classList.add("listening");
  micBtn.classList.remove("ready");
  setStatus("מתכונן…", "המתן עד שהמיקרופון יתחיל להאזין.");
}

function stopDictation() {
  if (!recognition) return;
  recognition.stop();
  recognition = null;
  state.listening = false;
  state.interimText = "";
  micBtn.setAttribute("aria-pressed", "false");
  micBtn.classList.remove("listening");
  micBtn.classList.remove("ready");
  setStatus("מוכן");
  render();
}

if (!getSpeechRecognition()) {
  micBtn.disabled = true;
  micBtn.title = "תמלול דורש Chrome או Edge";
  setStatus("מוכן", "תמלול דיבור דורש Chrome או Edge.");
}

syncThemeButtons();
render();
inputEl.focus();
