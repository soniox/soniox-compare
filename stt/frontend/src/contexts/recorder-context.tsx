import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LayoutWindowContext, useIsMobile } from "@/hooks/use-is-mobile";
import {
  downloadRecording,
  isRecordingSupported,
  openStage,
  startRecording,
  type ActiveRecording,
  type Recording,
  type Stage,
} from "@/lib/recorder";

// Keeps the session's final state in the video.
const TAIL_MS = 1000;
// Audio sources (mic, provider playback) appear once the session is running.
const AUDIO_POLL_MS = 250;

export type Recorder = {
  supported: boolean;
  isRecording: boolean;
  /** Recording, but the session hasn't started (or failed to). */
  isAwaitingSession: boolean;
  lastRecording: Recording | null;
  /** Starts recording, then `play`; stops and downloads after the session. */
  record: (play: () => void) => Promise<void>;
  stop: () => void;
  download: () => void;
};

const RecorderContext = createContext<Recorder | null>(null);

type RecorderProviderProps = {
  filenamePrefix: string;
  /** Image URL for the video's background. */
  background?: string;
  isSessionActive: boolean;
  getAudioStreams: () => MediaStream[];
  /** The app layout. While recording it's also rendered into the stage. */
  children: ReactNode;
};

export const RecorderProvider = ({
  filenamePrefix,
  background,
  isSessionActive,
  getAudioStreams,
  children,
}: RecorderProviderProps) => {
  const [supported] = useState(isRecordingSupported);
  const [stage, setStage] = useState<Stage | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [lastRecording, setLastRecording] = useState<Recording | null>(null);
  const startingRef = useRef(false);
  const activeRef = useRef<ActiveRecording | null>(null);

  const stop = useCallback(() => activeRef.current?.stop(), []);

  useEffect(() => {
    if (!isRecording) return;
    if (isSessionActive) {
      setSessionStarted(true);
      return;
    }
    if (!sessionStarted) return;
    const id = setTimeout(stop, TAIL_MS);
    return () => clearTimeout(id);
  }, [isRecording, isSessionActive, sessionStarted, stop]);

  useEffect(() => {
    if (!isRecording) return;
    const attach = () =>
      getAudioStreams().forEach((stream) =>
        activeRef.current?.addAudio(stream),
      );
    attach();
    const id = setInterval(attach, AUDIO_POLL_MS);
    return () => clearInterval(id);
  }, [isRecording, getAudioStreams]);

  useEffect(() => () => activeRef.current?.stop(), []);

  // Closed after React has unmounted the stage copy.
  useEffect(() => {
    if (!stage) return;
    return () => stage.close();
  }, [stage]);

  const record = useCallback(
    async (play: () => void) => {
      if (!supported || startingRef.current || activeRef.current) return;
      startingRef.current = true;

      const stageDocument = openStage().then(async (opened) => {
        setStage(opened);
        await opened.ready();
        return opened.document;
      });
      let active: ActiveRecording;
      try {
        active = await startRecording(stageDocument, {
          filenamePrefix,
          background,
        });
      } catch (err) {
        console.error("Recording not started:", err);
        setStage(null);
        return;
      } finally {
        startingRef.current = false;
      }

      activeRef.current = active;
      setSessionStarted(false);
      setIsRecording(true);
      play();

      try {
        const recording = await active.done;
        setLastRecording((previous) => {
          if (previous) URL.revokeObjectURL(previous.url);
          return recording;
        });
        downloadRecording(recording);
      } catch (err) {
        console.error("Recording failed:", err);
      } finally {
        activeRef.current = null;
        setIsRecording(false);
        setStage(null);
      }
    },
    [supported, filenamePrefix, background],
  );

  const download = useCallback(() => {
    if (lastRecording) downloadRecording(lastRecording);
  }, [lastRecording]);

  const recorder = useMemo<Recorder>(
    () => ({
      supported,
      isRecording,
      isAwaitingSession: isRecording && !sessionStarted && !isSessionActive,
      lastRecording,
      record,
      stop,
      download,
    }),
    [
      supported,
      isRecording,
      sessionStarted,
      isSessionActive,
      lastRecording,
      record,
      stop,
      download,
    ],
  );

  return (
    <RecorderContext.Provider value={recorder}>
      {children}
      {stage &&
        createPortal(
          <LayoutWindowContext.Provider value={stage.window}>
            {children}
          </LayoutWindowContext.Provider>,
          stage.document.body,
        )}
    </RecorderContext.Provider>
  );
};

/** Recording is offered with the desktop layout only. */
export const useCanRecord = () => {
  const { supported } = useRecorder();
  const isMobile = useIsMobile();
  return supported && !isMobile;
};

export const useRecorder = (): Recorder => {
  const recorder = useContext(RecorderContext);
  if (!recorder) {
    throw new Error("useRecorder must be used within a RecorderProvider");
  }
  return recorder;
};
