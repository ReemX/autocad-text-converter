/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = "ivrit-ai/whisper-large-v3-turbo-onnx";
const FALLBACK_MODEL_ID = "onnx-community/whisper-large-v3-turbo";

// Domain-specific prompt biases the decoder toward formal-Hebrew construction
// vocabulary. Whisper accepts ~224 prompt tokens. Keep terms high-signal:
// street names, common site-permit nouns, and a single sample-style sentence.
const INITIAL_PROMPT =
  "הסדרי תנועה זמניים לצורך חסימת רחוב ומדרכה. הריסה, פריקה וטעינה. " +
  "גדר אסכורית סביב האתר. גדר אטומה ניידת על משקולות כובד. " +
  "שדרות רוטשילד, שדרות ירושלים, רחוב בצלאל יפה, רחוב הרצל, רחוב אבן גבירול. " +
  "ביצוע נוהל אדום לבן. אבן שפה מונמכת לצורך נגישות לאתר. " +
  "הצבת באגר ומשאית בתוך שטח האתר. פינוי פסולת בניין. " +
  "הצבת שילוט מקדים, עגלת חץ, פיזור קונוסים על המסעה. " +
  "הצבת פקחים ואתתים לצורך הכוונה. מעקף להולכי הרגל. " +
  "חסימת נתיב ימני בשדרות. כלים כבדים. מצורפת מילואה.";

type PipelineWithTokenizer = ((
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text: string } | Array<{ text: string }>>) & {
  tokenizer: { encode: (text: string, options?: Record<string, unknown>) => number[] };
};

let transcriber: PipelineWithTokenizer | null = null;
let promptIds: number[] | null = null;
let loading: Promise<PipelineWithTokenizer> | null = null;

type ProgressData = {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type InMsg =
  | { type: "load" }
  | { type: "transcribe"; id: number; audio: Float32Array; language?: string };

type OutMsg =
  | { type: "progress"; data: ProgressData }
  | { type: "reset"; reason: string }
  | { type: "ready" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; error: string };

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: OutMsg) {
  ctx.postMessage(msg);
}

async function pickDevice(): Promise<"webgpu" | "wasm"> {
  try {
    const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
    if (nav.gpu) {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    // fall through
  }
  return "wasm";
}

async function tryLoad(
  modelId: string,
  device: "webgpu" | "wasm",
  dtype: unknown,
): Promise<PipelineWithTokenizer> {
  return (await pipeline("automatic-speech-recognition", modelId, {
    device,
    dtype: dtype as never,
    progress_callback: (data: ProgressData) => post({ type: "progress", data }),
  } as never)) as unknown as PipelineWithTokenizer;
}

function computePromptIds(pipe: PipelineWithTokenizer): number[] | null {
  try {
    // Whisper convention: prepend <|startofprev|> token, then prompt text,
    // tokenizer wraps with no special tokens added on top.
    return pipe.tokenizer.encode("<|startofprev|> " + INITIAL_PROMPT, {
      add_special_tokens: false,
    });
  } catch (err) {
    console.warn("[whisper] prompt encoding failed, continuing without prompt", err);
    return null;
  }
}

async function load(): Promise<PipelineWithTokenizer> {
  if (transcriber) return transcriber;
  if (loading) return loading;

  loading = (async () => {
    const device = await pickDevice();
    // Both encoder and decoder fp16 — max quality ivrit-ai ships.
    // Decoder fp16 (vs q4f16) eliminates token-level letter-swap noise.
    const primaryDtype = { encoder_model: "fp16", decoder_model_merged: "fp16" };

    try {
      const pipe = await tryLoad(MODEL_ID, device, primaryDtype);
      transcriber = pipe;
      promptIds = computePromptIds(pipe);
      post({ type: "ready" });
      return pipe;
    } catch (err) {
      console.warn("[whisper] ivrit-ai load failed, falling back to generic turbo", err);
      post({ type: "reset", reason: "fallback" });
      const fallbackDtype =
        device === "webgpu"
          ? { encoder_model: "fp16", decoder_model_merged: "q4" }
          : { encoder_model: "q8", decoder_model_merged: "q4" };
      const pipe = await tryLoad(FALLBACK_MODEL_ID, device, fallbackDtype);
      transcriber = pipe;
      promptIds = computePromptIds(pipe);
      post({ type: "ready" });
      return pipe;
    }
  })();

  return loading;
}

ctx.onmessage = async (event: MessageEvent<InMsg>) => {
  const msg = event.data;

  try {
    if (msg.type === "load") {
      await load();
      return;
    }

    if (msg.type === "transcribe") {
      const pipe = await load();
      const options: Record<string, unknown> = {
        language: msg.language ?? "he",
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      };
      if (promptIds) options.prompt_ids = promptIds;
      const result = await pipe(msg.audio, options);
      const text = Array.isArray(result)
        ? result.map((r) => r.text).join(" ")
        : result.text;
      post({ type: "result", id: msg.id, text });
    }
  } catch (err) {
    post({
      type: "error",
      id: msg.type === "transcribe" ? msg.id : undefined,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
