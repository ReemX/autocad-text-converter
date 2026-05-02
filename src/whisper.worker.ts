/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = "onnx-community/whisper-large-v3-turbo";

type AnyPipeline = (
  audio: Float32Array,
  options?: Record<string, unknown>,
) => Promise<{ text: string } | Array<{ text: string }>>;

let transcriber: AnyPipeline | null = null;
let loading: Promise<AnyPipeline> | null = null;

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
): Promise<AnyPipeline> {
  return (await pipeline("automatic-speech-recognition", modelId, {
    device,
    dtype: dtype as never,
    progress_callback: (data: ProgressData) => post({ type: "progress", data }),
  } as never)) as unknown as AnyPipeline;
}

async function load(): Promise<AnyPipeline> {
  if (transcriber) return transcriber;
  if (loading) return loading;

  loading = (async () => {
    const device = await pickDevice();
    // q4 keeps weights small enough to fit comfortably in browser memory
    // (~200MB total) while preserving Hebrew accuracy reasonably well.
    const primaryDtype =
      device === "webgpu"
        ? { encoder_model: "fp16", decoder_model_merged: "q4" }
        : { encoder_model: "q8", decoder_model_merged: "q4" };

    try {
      const pipe = await tryLoad(MODEL_ID, device, primaryDtype);
      transcriber = pipe;
      post({ type: "ready" });
      return pipe;
    } catch (err) {
      console.warn("[whisper] primary load failed, retrying smaller", err);
      post({ type: "reset", reason: "fallback" });
      const pipe = await tryLoad("Xenova/whisper-base", device, "q8");
      transcriber = pipe;
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
      const result = await pipe(msg.audio, {
        language: msg.language ?? "he",
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });
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
