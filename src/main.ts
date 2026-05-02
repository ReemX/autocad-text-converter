import "./style.css";
import { convert } from "./translator/convert.ts";
import { applySymbols } from "./symbols.ts";
import { Whisper, type ProgressData } from "./whisper.ts";
import { startRecording, type Recorder } from "./recorder.ts";
import { applyTheme, loadTheme, type Theme } from "./theme.ts";

function isMobile(): boolean {
  if (/Android|iPhone|iPad|iPod|Mobi|Mobile/i.test(navigator.userAgent)) return true;
  // iPadOS reports MacIntel UA — detect via touch capability
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

if (isMobile()) {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div class="mobile-block">
      <div class="mobile-block-card">
        <h1 class="mobile-block-title">זמין במחשב בלבד</h1>
        <p class="mobile-block-body">
          האתר משתמש במודל תמלול גדול שדורש זיכרון ומשאבי חישוב
          שלא זמינים בטלפון או בטאבלט.
        </p>
        <p class="mobile-block-body">
          פתח את הקישור במחשב שולחני או נייד.
        </p>
        <p class="mobile-block-byline">
          מאת
          <a href="https://github.com/ReemX" target="_blank" rel="noopener noreferrer">ראם אסף</a>
        </p>
      </div>
    </div>
  `;
  throw new Error("mobile not supported");
}

type Phase = "idle" | "recording" | "transcribing";

type State = {
  finalText: string;
  phase: Phase;
  theme: Theme;
};

const state: State = {
  finalText: "",
  phase: "idle",
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

const SVG_HELP = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9a2.7 2.7 0 1 1 4.2 2.3c-.9.6-1.5 1-1.5 2.2" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </svg>`;

const KEYWORD_ROWS: Array<[string, string]> = [
  ["פלוס", "+"],
  ["מינוס · מקף", "-"],
  ["סלש · סלאש", "/"],
  ["כפול · כוכבית", "*"],
  ["שווה", "="],
  ["אחוז", "%"],
  ["שטרודל", "@"],
  ["סולמית · האשטג", "#"],
  ["נקודה", "."],
  ["פסיק", ","],
  ["נקודה פסיק", ";"],
  ["נקודותיים", ":"],
  ["פתח סוגריים", "("],
  ["סגור סוגריים", ")"],
  ["ירידת שורה · רד שורה", "↵"],
];

const HELP_ROWS_HTML = KEYWORD_ROWS
  .map(([word, sym]) => `<tr><td>${word}</td><td>${sym}</td></tr>`)
  .join("");

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

    <div class="help-toggle" tabindex="0" aria-label="עזרה: מילות מפתח לסמלים">
      <span class="help-icon">${SVG_HELP}</span>
      <div class="help-tooltip" role="tooltip">
        <p class="help-tooltip-title">מילות מפתח בדיבור</p>
        <p class="help-tooltip-sub">אמור את המילה במהלך תמלול והיא תהפוך לסמל בטקסט.</p>
        <table class="help-tooltip-table">${HELP_ROWS_HTML}</table>
      </div>
    </div>

    <header class="masthead">
      <h1 class="title">ממיר טקסט · אוטוקאד</h1>
      <p class="byline">
        מאת
        <a href="https://github.com/ReemX" target="_blank" rel="noopener noreferrer">ראם אסף</a>
      </p>
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
      <div class="transcribe-progress" data-role="transcribe-progress" hidden>
        <div class="transcribe-bar"></div>
      </div>
    </footer>
  </main>

  <div class="model-overlay" data-role="model-overlay" hidden>
    <div class="model-card" role="dialog" aria-modal="true" aria-labelledby="model-title">
      <h2 id="model-title" class="model-title">טוען מודל תמלול</h2>
      <p class="model-sub" data-role="model-sub">
        ההורדה היא חד-פעמית. בפעמים הבאות הטעינה תהיה מהירה.
      </p>
      <div class="progress-shell">
        <div class="progress-bar" data-role="progress-bar"></div>
      </div>
      <div class="progress-meta">
        <span class="progress-percent" data-role="progress-percent">0%</span>
        <span class="progress-bytes" data-role="progress-bytes"></span>
      </div>
      <p class="model-warning">אל תסגור את החלון עד לסיום ההורדה.</p>
    </div>
  </div>
`;

const inputEl = app.querySelector<HTMLTextAreaElement>('[data-role="input-text"]')!;
const micBtn = app.querySelector<HTMLButtonElement>('[data-role="mic"]')!;
const copyBtn = app.querySelector<HTMLButtonElement>('[data-role="copy"]')!;
const copyIcon = app.querySelector<HTMLSpanElement>('[data-role="copy-icon"]')!;
const copyLabel = app.querySelector<HTMLSpanElement>('[data-role="copy-label"]')!;
const statusLabel = app.querySelector<HTMLSpanElement>('[data-role="status-label"]')!;
const hintEl = app.querySelector<HTMLParagraphElement>('[data-role="hint"]')!;
const themeButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-theme-value]"),
);

const transcribeProgressEl = app.querySelector<HTMLDivElement>('[data-role="transcribe-progress"]')!;

const overlayEl = document.querySelector<HTMLDivElement>('[data-role="model-overlay"]')!;
const overlaySub = document.querySelector<HTMLParagraphElement>('[data-role="model-sub"]')!;
const progressBar = document.querySelector<HTMLDivElement>('[data-role="progress-bar"]')!;
const progressPercent = document.querySelector<HTMLSpanElement>('[data-role="progress-percent"]')!;
const progressBytes = document.querySelector<HTMLSpanElement>('[data-role="progress-bytes"]')!;

let copyResetTimer: ReturnType<typeof setTimeout> | null = null;
let recorder: Recorder | null = null;
let transcribeTimerHandle: ReturnType<typeof setInterval> | null = null;
const fileBytes = new Map<string, { loaded: number; total: number }>();

function fmtClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function startTranscribeProgress(audioSeconds: number) {
  transcribeProgressEl.hidden = false;
  const startedAt = performance.now();
  const audioLabel = `הקלטה ${fmtClock(audioSeconds)}`;
  const tick = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    setStatus("מתמלל…", `${audioLabel} · חלפו ${fmtClock(elapsed)}`);
  };
  tick();
  transcribeTimerHandle = setInterval(tick, 250);
}

function stopTranscribeProgress() {
  if (transcribeTimerHandle) clearInterval(transcribeTimerHandle);
  transcribeTimerHandle = null;
  transcribeProgressEl.hidden = true;
}

function syncThemeButtons() {
  for (const b of themeButtons) {
    const value = b.dataset.themeValue as Theme;
    b.setAttribute("aria-pressed", String(value === state.theme));
  }
}

function render() {
  if (inputEl.value !== state.finalText) inputEl.value = state.finalText;
  copyBtn.disabled = state.finalText.trim().length === 0;
}

function setStatus(label: string, hint = "", isError = false) {
  statusLabel.textContent = label;
  hintEl.textContent = hint;
  hintEl.classList.toggle("error", isError);
}

function showOverlay() {
  overlayEl.hidden = false;
  document.body.classList.add("overlay-open");
}

function hideOverlay() {
  overlayEl.hidden = true;
  document.body.classList.remove("overlay-open");
}

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function updateProgressUI(data: ProgressData) {
  if (data.file && typeof data.loaded === "number" && typeof data.total === "number" && data.total > 0) {
    fileBytes.set(data.file, { loaded: data.loaded, total: data.total });
  }

  let totalLoaded = 0;
  let totalSize = 0;
  for (const v of fileBytes.values()) {
    totalLoaded += v.loaded;
    totalSize += v.total;
  }

  const percent = totalSize > 0 ? Math.min(100, Math.round((totalLoaded / totalSize) * 100)) : 0;

  if (data.status === "initiate" || data.status === "download" || data.status === "progress") {
    overlaySub.textContent = "ההורדה היא חד-פעמית. בפעמים הבאות הטעינה תהיה מהירה.";
  } else if (data.status === "done") {
    overlaySub.textContent = "ההורדה הסתיימה. מאתחל את המודל…";
  } else if (data.status === "ready") {
    overlaySub.textContent = "המודל מוכן.";
  }

  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressBytes.textContent =
    totalSize > 0 ? `${formatMB(totalLoaded)} / ${formatMB(totalSize)}` : "";
}

const whisper = new Whisper({
  onProgress: (data) => {
    if (overlayEl.hidden) showOverlay();
    updateProgressUI(data);
  },
  onReset: () => {
    fileBytes.clear();
    progressBar.style.width = "0%";
    progressPercent.textContent = "0%";
    progressBytes.textContent = "";
    overlaySub.textContent =
      "המודל הראשי לא נטען. עובר לגרסה קלה יותר…";
  },
  onReady: () => {
    progressBar.style.width = "100%";
    progressPercent.textContent = "100%";
    overlaySub.textContent = "המודל מוכן. אפשר להתחיל בהקלטה.";
    setTimeout(() => hideOverlay(), 600);
    setStatus("מוכן");
  },
  onError: (err) => {
    console.error("[whisper]", err);
    hideOverlay();
    setStatus("שגיאת מודל", err, true);
    state.phase = "idle";
    updateMicButton();
  },
});

for (const b of themeButtons) {
  b.addEventListener("click", () => {
    state.theme = b.dataset.themeValue as Theme;
    applyTheme(state.theme);
    syncThemeButtons();
  });
}

inputEl.addEventListener("input", () => {
  state.finalText = inputEl.value;
  render();
});

copyBtn.addEventListener("click", async () => {
  const source = state.finalText;
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
  if (state.phase === "recording") stopRecording();
  else if (state.phase === "idle") startMicFlow();
});

function updateMicButton() {
  micBtn.classList.toggle("listening", state.phase === "recording");
  micBtn.classList.toggle("ready", state.phase === "recording");
  micBtn.classList.toggle("busy", state.phase === "transcribing");
  micBtn.disabled = state.phase === "transcribing";
  micBtn.setAttribute("aria-pressed", String(state.phase === "recording"));
}

async function startMicFlow() {
  if (!whisper.isReady()) {
    showOverlay();
    whisper.load();
    setStatus("מוריד מודל…", "ההורדה הראשונה יכולה לקחת מספר דקות.");
    return;
  }
  await beginRecording();
}

async function beginRecording() {
  try {
    recorder = await startRecording();
    state.phase = "recording";
    updateMicButton();
    setStatus("מקליט", "לחץ שוב לסיום והוספת הטקסט.");
  } catch (err) {
    console.error("[recorder]", err);
    const isPermission =
      err instanceof DOMException &&
      (err.name === "NotAllowedError" || err.name === "SecurityError");
    setStatus(
      "שגיאה",
      isPermission
        ? "אין הרשאה למיקרופון. אפשר בדפדפן ונסה שוב."
        : "המיקרופון לא זמין.",
      true,
    );
    state.phase = "idle";
    updateMicButton();
  }
}

async function stopRecording() {
  if (!recorder) return;
  const r = recorder;
  recorder = null;
  state.phase = "transcribing";
  updateMicButton();
  setStatus("מתמלל…", "ממתין למודל.");

  try {
    const audio = await r.stop();
    if (audio.length < 1600) {
      setStatus("קצר מדי", "ההקלטה קצרה מדי. נסה שוב.", true);
      state.phase = "idle";
      updateMicButton();
      return;
    }
    startTranscribeProgress(audio.length / 16000);
    const raw = await whisper.transcribe(audio, "he");
    const text = applySymbols(raw).trim();
    if (text) {
      const sep = state.finalText && !/\s$/.test(state.finalText) ? " " : "";
      state.finalText = state.finalText + sep + text + " ";
      render();
      setStatus("מוכן");
    } else {
      setStatus("לא זוהה דיבור", "נסה שוב, קרוב יותר למיקרופון.", true);
    }
  } catch (err) {
    console.error("[transcribe]", err);
    setStatus("שגיאת תמלול", err instanceof Error ? err.message : String(err), true);
  } finally {
    stopTranscribeProgress();
    state.phase = "idle";
    updateMicButton();
  }
}

async function purgeStaleModelCache() {
  const VERSION_KEY = "model-cache-version";
  const CURRENT = "ivrit-v2-fp16";
  if (localStorage.getItem(VERSION_KEY) === CURRENT) return;
  if (!("caches" in window)) {
    localStorage.setItem(VERSION_KEY, CURRENT);
    return;
  }
  const STALE_PATHS = [
    "/onnx-community/whisper-large-v3-turbo/",
    "/Xenova/whisper-base/",
    "decoder_model_merged_q4f16",
  ];
  try {
    const names = await caches.keys();
    for (const name of names) {
      if (!name.includes("transformers")) continue;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      const stale = keys.filter((req) => STALE_PATHS.some((p) => req.url.includes(p)));
      await Promise.all(stale.map((req) => cache.delete(req)));
      if (stale.length > 0) console.log(`[cache] purged ${stale.length} stale model files from ${name}`);
    }
  } catch (err) {
    console.warn("[cache] purge skipped", err);
  } finally {
    localStorage.setItem(VERSION_KEY, CURRENT);
  }
}

(async () => {
  await purgeStaleModelCache();
  setTimeout(() => {
    if (!whisper.hasStartedLoading()) whisper.load();
  }, 800);
})();

if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
  micBtn.disabled = true;
  micBtn.title = "המיקרופון לא זמין בדפדפן זה";
  setStatus("מוכן", "תמלול דורש דפדפן עם תמיכה במיקרופון.");
}

syncThemeButtons();
render();
inputEl.focus();
