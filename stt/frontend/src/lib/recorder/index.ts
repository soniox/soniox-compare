// Records a document without screen capture: on every change it's cloned into
// an SVG image (snapshot), drawn on a 16:9 canvas (compositor) and encoded
// with the app's own audio (audio-mixer, encoder).
import { createAudioMixer } from "./audio-mixer";
import { createCompositor } from "./compositor";
import { startEncoder, type Recording } from "./encoder";
import { createSnapshotter, type Snapshot } from "./snapshot";

export type { Recording } from "./encoder";
export { openStage, type Stage } from "./stage";

const MAX_FPS = 20;
const MIN_FRAME_INTERVAL_MS = 1000 / MAX_FPS;
// Re-sends the last frame while nothing changes so the video keeps its timing.
const HEARTBEAT_MS = 500;

export type RecordingOptions = {
  filenamePrefix: string;
  /** Image URL for the background around the app. */
  background?: string;
};

export type ActiveRecording = {
  stop: () => void;
  done: Promise<Recording>;
  addAudio: (stream: MediaStream) => void;
};

export const isRecordingSupported = () =>
  typeof MediaRecorder !== "undefined" &&
  typeof HTMLCanvasElement.prototype.captureStream === "function";

// Canvases and CSS animations change without DOM mutations, so while there
// are any the page is redrawn at the frame cap.
const startFrameLoop = (
  doc: Document,
  renderFrame: () => Promise<void>,
  pushFrame: () => void,
) => {
  const view = doc.defaultView!;
  let running = true;
  let dirty = false;
  let busy = false;
  let lastDrawAt = performance.now();
  let lastPushAt = lastDrawAt;

  const markDirty = () => {
    dirty = true;
  };
  const observer = new MutationObserver(markDirty);
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  doc.addEventListener("scroll", markDirty, { capture: true, passive: true });
  view.addEventListener("resize", markDirty);

  const isAnimating = () =>
    doc.body.querySelector("canvas") !== null ||
    doc.getAnimations().some((a) => a.playState === "running");

  const tick = async () => {
    const now = performance.now();
    if (
      !busy &&
      now - lastDrawAt >= MIN_FRAME_INTERVAL_MS &&
      (dirty || isAnimating())
    ) {
      busy = true;
      dirty = false;
      lastDrawAt = now;
      try {
        await renderFrame();
        if (running) {
          pushFrame();
          lastPushAt = performance.now();
        }
      } catch (err) {
        console.warn("Skipped a recording frame:", err);
      } finally {
        busy = false;
      }
    }
    if (running && now - lastPushAt >= HEARTBEAT_MS) {
      pushFrame();
      lastPushAt = now;
    }
  };
  const timer = setInterval(() => void tick(), MIN_FRAME_INTERVAL_MS / 2);

  return () => {
    running = false;
    clearInterval(timer);
    observer.disconnect();
    doc.removeEventListener("scroll", markDirty, { capture: true });
    view.removeEventListener("resize", markDirty);
  };
};

/**
 * Records `source` until stopped. It may still be getting ready (the stage),
 * so audio is set up first, while the user's click still counts for autoplay.
 */
export const startRecording = async (
  source: Document | Promise<Document>,
  { filenamePrefix, background }: RecordingOptions,
): Promise<ActiveRecording> => {
  const mixer = createAudioMixer();
  const compositorReady = createCompositor(background);
  let doc: Document;
  let snapshot: () => Promise<Snapshot>;
  let hasAudio: boolean;
  let compositor: Awaited<typeof compositorReady>;
  let first: Snapshot;
  try {
    doc = await source;
    [snapshot, hasAudio, compositor] = await Promise.all([
      createSnapshotter(doc),
      mixer.start(),
      compositorReady,
    ]);
    first = await snapshot();
  } catch (err) {
    mixer.close();
    throw err;
  }

  compositor.draw(first);
  const stream = compositor.canvas.captureStream(0);
  const video = stream.getVideoTracks()[0];
  // Chrome and Safari take frame requests on the track, Firefox on the stream.
  const frameSource = ("requestFrame" in video ? video : stream) as unknown as {
    requestFrame: () => void;
  };
  const pushFrame = () => frameSource.requestFrame();
  // Without audio data the MP4 muxer stalls too; record silently instead.
  if (hasAudio) stream.addTrack(mixer.track);

  const cleanup = () => {
    stream.getTracks().forEach((track) => track.stop());
    mixer.close();
  };
  let encoder: ReturnType<typeof startEncoder>;
  try {
    encoder = startEncoder(stream, filenamePrefix);
  } catch (err) {
    cleanup();
    throw err;
  }
  pushFrame();

  const stopFrameLoop = startFrameLoop(
    doc,
    async () => compositor.draw(await snapshot()),
    pushFrame,
  );
  const finish = () => {
    stopFrameLoop();
    cleanup();
  };
  encoder.done.then(finish, finish);

  return {
    stop() {
      pushFrame();
      encoder.stop();
    },
    done: encoder.done,
    addAudio: mixer.add,
  };
};

export const downloadRecording = ({ url, filename }: Recording) => {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
