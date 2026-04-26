import "./style.css";
import { convert, type Direction } from "./translator/convert.ts";
import { createDictation, getSpeechRecognition } from "./speech.ts";
import { applyTheme, loadTheme, type Theme } from "./theme.ts";

type State = {
  direction: Direction;
  finalText: string;
  interimText: string;
  listening: boolean;
  theme: Theme;
};

const state: State = {
  direction: "he-to-en",
  finalText: "",
  interimText: "",
  listening: false,
  theme: loadTheme(),
};

applyTheme(state.theme);

const SVG_SWAP = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 8h14M5 8l4-4M5 8l4 4" />
    <path d="M19 16H5M19 16l-4-4M19 16l-4 4" />
  </svg>`;

const SVG_MIC = `
  <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3M9 21h6" />
  </svg>`;

const SVG_COPY = `
  <svg class="btn-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="1" />
    <path d="M5 15V5a2 2 0 012-2h10" />
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
      <button data-theme-value="auto" type="button">AUTO</button>
      <button data-theme-value="light" type="button">LIGHT</button>
      <button data-theme-value="dark" type="button">DARK</button>
    </div>

    <div class="stamp" aria-hidden="true">
      <div class="stamp-cell">
        <span class="stamp-key">SHEET</span>
        <span class="stamp-val">01</span>
      </div>
      <div class="stamp-cell">
        <span class="stamp-key">REV</span>
        <span class="stamp-val">02</span>
      </div>
      <div class="stamp-cell">
        <span class="stamp-key">SCALE</span>
        <span class="stamp-val">1:1</span>
      </div>
      <div class="stamp-cell">
        <span class="stamp-key">FORMAT</span>
        <span class="stamp-val">HE⇄EN</span>
      </div>
    </div>

    <header class="masthead">
      <span class="eyebrow">HE-EN KEYBOARD MAP</span>
      <h1 class="title">ממיר טקסט · אוטוקאד</h1>
      <p class="subtitle">מיפוי מקלדת עברי-אנגלי לתצוגת אוטוקאד · תמלול דיבור חי</p>
    </header>

    <section class="converter" aria-label="ממיר טקסט">
      <div class="pane" data-role="input">
        ${REG_MARKS}
        <div class="pane-header">
          <span class="lang-label" data-role="input-label"></span>
          <button class="btn mic-btn" data-role="mic" type="button" aria-pressed="false">
            ${SVG_MIC}
            <span data-role="mic-label">מיקרופון</span>
          </button>
        </div>
        <textarea
          class="textbox input"
          data-role="input-text"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
        ></textarea>
      </div>

      <div class="divider" aria-hidden="true">
        <span class="dim-line"></span>
        <button class="swap-btn" data-role="swap" type="button" aria-label="החלף כיוון">
          ${SVG_SWAP}
        </button>
        <span class="dim-line"></span>
      </div>

      <div class="pane" data-role="output">
        ${REG_MARKS}
        <div class="pane-header">
          <span class="lang-label" data-role="output-label"></span>
          <button class="btn copy-btn" data-role="copy" type="button" aria-label="העתק פלט">
            ${SVG_COPY}
            <span data-role="copy-label">העתק</span>
          </button>
        </div>
        <textarea
          class="textbox output"
          data-role="output-text"
          spellcheck="false"
          readonly
        ></textarea>
      </div>
    </section>

    <footer class="status">
      <span class="status-pulse" aria-hidden="true"></span>
      <span class="status-label" data-role="status-label">READY</span>
      <p class="hint" data-role="hint"></p>
    </footer>
  </main>
`;

const inputEl = app.querySelector<HTMLTextAreaElement>('[data-role="input-text"]')!;
const outputEl = app.querySelector<HTMLTextAreaElement>('[data-role="output-text"]')!;
const swapBtn = app.querySelector<HTMLButtonElement>('[data-role="swap"]')!;
const micBtn = app.querySelector<HTMLButtonElement>('[data-role="mic"]')!;
const copyBtn = app.querySelector<HTMLButtonElement>('[data-role="copy"]')!;
const copyLabel = app.querySelector<HTMLSpanElement>('[data-role="copy-label"]')!;
const inputLabel = app.querySelector<HTMLSpanElement>('[data-role="input-label"]')!;
const outputLabel = app.querySelector<HTMLSpanElement>('[data-role="output-label"]')!;
const statusLabel = app.querySelector<HTMLSpanElement>('[data-role="status-label"]')!;
const hintEl = app.querySelector<HTMLParagraphElement>('[data-role="hint"]')!;
const themeButtons = Array.from(
  app.querySelectorAll<HTMLButtonElement>("[data-theme-value]"),
);

let recognition: ReturnType<typeof createDictation> = null;

function syncThemeButtons() {
  for (const b of themeButtons) {
    const value = b.dataset.themeValue as Theme;
    b.setAttribute("aria-pressed", String(value === state.theme));
  }
}

function applyDirection() {
  const isHeToEn = state.direction === "he-to-en";
  inputLabel.textContent = isHeToEn ? "עברית" : "אנגלית";
  outputLabel.textContent = isHeToEn ? "אנגלית" : "עברית";
  inputEl.dir = isHeToEn ? "rtl" : "ltr";
  outputEl.dir = isHeToEn ? "ltr" : "rtl";
  inputEl.lang = isHeToEn ? "he" : "en";
  outputEl.lang = isHeToEn ? "en" : "he";
  inputEl.placeholder = isHeToEn ? "כתוב או דבר..." : "Type to convert...";
  micBtn.disabled = !isHeToEn || !getSpeechRecognition();
  micBtn.title = isHeToEn
    ? "הפעל תמלול דיבור (עברית)"
    : "תמלול זמין במצב עברית בלבד";
}

function render() {
  const combined = state.finalText + state.interimText;
  if (inputEl.value !== combined) inputEl.value = combined;
  outputEl.value = convert(combined, state.direction);
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

swapBtn.addEventListener("click", () => {
  stopDictation();
  state.direction = state.direction === "he-to-en" ? "en-to-he" : "he-to-en";
  state.finalText = inputEl.value;
  state.interimText = "";
  applyDirection();
  render();
});

copyBtn.addEventListener("click", async () => {
  if (!outputEl.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
    const original = copyLabel.textContent;
    copyLabel.textContent = "הועתק";
    copyBtn.style.borderColor = "var(--accent-cool)";
    copyBtn.style.color = "var(--accent-cool)";
    setTimeout(() => {
      copyLabel.textContent = original;
      copyBtn.style.borderColor = "";
      copyBtn.style.color = "";
    }, 1300);
  } catch {
    setStatus("ERROR", "ההעתקה נכשלה. נסה שוב.", true);
  }
});

micBtn.addEventListener("click", () => {
  if (state.listening) stopDictation();
  else startDictation();
});

function startDictation() {
  if (state.direction !== "he-to-en") return;
  recognition = createDictation("he-IL", {
    onFinal: (text) => {
      const sep = state.finalText && !state.finalText.endsWith(" ") ? " " : "";
      state.finalText = state.finalText + sep + text.trim() + " ";
      state.interimText = "";
      render();
    },
    onInterim: (text) => {
      state.interimText = text;
      render();
    },
    onError: (error) => {
      setStatus("ERROR", `שגיאת מיקרופון: ${error}`, true);
      stopDictation();
    },
    onEnd: () => {
      state.listening = false;
      micBtn.setAttribute("aria-pressed", "false");
      micBtn.classList.remove("listening");
      setStatus("READY");
    },
  });
  if (!recognition) {
    setStatus("UNAVAILABLE", "תמלול דיבור אינו זמין בדפדפן זה.", true);
    return;
  }
  recognition.start();
  state.listening = true;
  micBtn.setAttribute("aria-pressed", "true");
  micBtn.classList.add("listening");
  setStatus("LISTENING", "");
}

function stopDictation() {
  if (!recognition) return;
  recognition.stop();
  recognition = null;
  state.listening = false;
  state.interimText = "";
  micBtn.setAttribute("aria-pressed", "false");
  micBtn.classList.remove("listening");
  setStatus("READY");
  render();
}

if (!getSpeechRecognition()) {
  setStatus("READY", "תמלול דיבור דורש Chrome או Edge.");
}

syncThemeButtons();
applyDirection();
render();
