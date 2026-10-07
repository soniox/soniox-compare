// isTypeSupported can't tell whether the encoder accepts the resolution, so a
// format that fails once started falls back to the next.
const MIME_TYPES = [
  "video/mp4;codecs=avc1.640033,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
const VIDEO_BITS_PER_SECOND = 30_000_000;
const AUDIO_BITS_PER_SECOND = 192_000;

export type Recording = {
  blob: Blob;
  url: string;
  filename: string;
};

const filenameFor = (prefix: string, mimeType: string) => {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
  const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  return `${prefix}-${stamp}.${extension}`;
};

export const startEncoder = (stream: MediaStream, filenamePrefix: string) => {
  const mimeTypes = MIME_TYPES.filter((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  if (mimeTypes.length === 0) throw new Error("No supported recording format");

  let recorder: MediaRecorder | null = null;
  let stopRequested = false;
  let settled = false;
  let resolve!: (recording: Recording) => void;
  let reject!: (error: unknown) => void;
  const done = new Promise<Recording>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const finish = (mimeType: string, chunks: Blob[], error?: unknown) => {
    if (settled) return;
    settled = true;
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size === 0) {
      reject(error ?? new Error("Recording is empty"));
      return;
    }
    resolve({
      blob,
      url: URL.createObjectURL(blob),
      filename: filenameFor(filenamePrefix, mimeType),
    });
  };

  const start = (index: number) => {
    const mimeType = mimeTypes[index];
    const canFallBack = () => !stopRequested && index + 1 < mimeTypes.length;
    const chunks: Blob[] = [];
    let superseded = false;

    let current: MediaRecorder;
    try {
      current = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
    } catch (err) {
      if (canFallBack()) start(index + 1);
      else finish(mimeType, [], err);
      return;
    }
    const actualType = () => current.mimeType || mimeType;

    current.addEventListener("dataavailable", (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    });
    current.addEventListener("error", (e) => {
      const error = (e as ErrorEvent).error ?? new Error("Recording failed");
      if (chunks.length === 0 && canFallBack()) {
        console.warn(`Recording as ${mimeType} failed, falling back:`, error);
        superseded = true;
        start(index + 1);
        return;
      }
      console.error("Recording failed:", error);
      // "stop" normally follows with the final data; don't wait forever.
      setTimeout(() => finish(actualType(), chunks, error), 1000);
    });
    current.addEventListener("stop", () => {
      if (!superseded) finish(actualType(), chunks);
    });

    recorder = current;
    current.start(1000);
  };

  start(0);

  return {
    done,
    stop() {
      stopRequested = true;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    },
  };
};
