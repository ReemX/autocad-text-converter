export type ProgressData = {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

export type WhisperCallbacks = {
  onProgress: (data: ProgressData) => void;
  onReady: () => void;
  onError: (error: string) => void;
  onReset?: (reason: string) => void;
};

export class Whisper {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (text: string) => void; reject: (e: Error) => void }
  >();
  private cb: WhisperCallbacks;
  private ready = false;
  private loadStarted = false;

  constructor(cb: WhisperCallbacks) {
    this.cb = cb;
    this.worker = new Worker(
      new URL("./whisper.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (e) => this.handleMessage(e);
    this.worker.onerror = (e) => this.cb.onError(e.message || "Worker error");
  }

  isReady() {
    return this.ready;
  }

  hasStartedLoading() {
    return this.loadStarted;
  }

  load() {
    if (this.loadStarted) return;
    this.loadStarted = true;
    this.worker.postMessage({ type: "load" });
  }

  transcribe(audio: Float32Array, language = "he"): Promise<string> {
    if (!this.loadStarted) this.load();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const buf = audio.buffer.slice(0) as ArrayBuffer;
      const copy = new Float32Array(buf);
      this.worker.postMessage(
        { type: "transcribe", id, audio: copy, language },
        [buf],
      );
    });
  }

  private handleMessage(e: MessageEvent) {
    const msg = e.data;
    if (msg.type === "progress") {
      this.cb.onProgress(msg.data);
    } else if (msg.type === "reset") {
      this.cb.onReset?.(msg.reason);
    } else if (msg.type === "ready") {
      this.ready = true;
      this.cb.onReady();
    } else if (msg.type === "result") {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        p.resolve(msg.text);
      }
    } else if (msg.type === "error") {
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.reject(new Error(msg.error));
        }
      } else {
        this.cb.onError(msg.error);
      }
    }
  }
}
