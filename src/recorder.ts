const TARGET_SAMPLE_RATE = 16000;

export type Recorder = {
  stop: () => Promise<Float32Array>;
  cancel: () => void;
};

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  const mimeType = pickMimeType();
  const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();

  let cancelled = false;

  return {
    cancel() {
      cancelled = true;
      try {
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      } catch {
        // ignore
      }
      stream.getTracks().forEach((t) => t.stop());
    },
    stop() {
      return new Promise<Float32Array>((resolve, reject) => {
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (cancelled) {
            reject(new Error("cancelled"));
            return;
          }
          try {
            const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
            const samples = await decodeAndResample(blob);
            resolve(samples);
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        };
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      });
    },
  };
}

function pickMimeType(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

async function decodeAndResample(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const tempCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await tempCtx.close();
  }

  const length = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}
