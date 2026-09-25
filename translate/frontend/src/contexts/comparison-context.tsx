import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { ALL_PROVIDERS_LIST, type ProviderName } from "../lib/provider-features";
import { activeProviders, useUrlSettings } from "../hooks/use-url-settings";
import { notifyParentDemoStarted } from "../lib/embed";
import { PcmPlayer } from "../lib/pcm-player";
import type { TranslationStatus } from "../lib/translation-blocks";

// After sending "END" we keep the socket's message handler attached for a short
// window so providers that only finalize on close can flush their last
// translation before we close the connection.
const WS_DRAIN_MS = 5000;

// How long to wait for every provider's `session_done` after the source audio
// runs out. Generous: speech-to-speech providers keep synthesizing well past
// their last input frame (Soniox force-closes its STT socket after 5s, Gemini
// caps its drain at 20s), and cutting early truncates the translated speech.
const SESSION_DONE_TIMEOUT_MS = 30000;

// While translated speech is playing, drop the source file to a murmur so the
// two don't compete. Matches the vanilla app's ducking behaviour.
const DUCKED_SOURCE_VOLUME = 0.1;

export interface TranscriptPart {
  text: string;
  speaker?: number | null;
  language?: string | null;
  sourceLanguage?: string | null;
  translationStatus?: TranslationStatus | null;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}

export interface InfoMessage {
  message: string;
  level: "info" | "warning" | "error";
}

export interface OutputData {
  statusMessage: string;
  finalParts: TranscriptPart[];
  nonFinalParts: TranscriptPart[];
  error: string;
  infoMessages: InfoMessage[];
}

export type ProviderOutputs = Record<ProviderName, OutputData>;

// Tracks when a provider produced its first and most recent transcript token in
// the current session. Used to estimate cost over the provider's *active*
// window (first token -> last token) rather than the full session duration.
export interface ProviderTiming {
  firstTokenAt: number | null;
  lastTokenAt: number | null;
}

export type ProviderTimings = Record<ProviderName, ProviderTiming>;

export type AudioRecordingState =
  | "idle"
  | "starting"
  | "connecting"
  | "recording"
  | "stopping";

interface ComparisonContextState {
  recordingState: AudioRecordingState;
  providerOutputs: ProviderOutputs;
  providerTimings: ProviderTimings;
  appError: string | null;
  audioReady: boolean;
  selectedAudioFileName: string | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  analyserRef: React.RefObject<AnalyserNode | null>;
}

interface ComparisonContextActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  togglePreview: () => Promise<void>;
  clearTranscriptOutputs: () => void;
  setAudio: (audioUrl: string, fileName?: string) => void;
  clearAudio: () => void;
}

type ComparisonContextType = ComparisonContextState & ComparisonContextActions;

interface BackendTranscriptPart {
  text: string;
  is_final: boolean;
  speaker?: number | null;
  language?: string | null;
  source_language?: string | null;
  translation_status?: TranslationStatus | null;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}

const initializeProviderOutputs = (
  providers: ProviderName[]
): ProviderOutputs => {
  const initialOutput: OutputData = {
    statusMessage: "",
    finalParts: [],
    nonFinalParts: [],
    error: "",
    infoMessages: [],
  };
  return providers.reduce((acc, provider) => {
    acc[provider] = { ...initialOutput };
    return acc;
  }, {} as ProviderOutputs);
};

const initializeProviderTimings = (
  providers: ProviderName[]
): ProviderTimings =>
  providers.reduce((acc, provider) => {
    acc[provider] = { firstTokenAt: null, lastTokenAt: null };
    return acc;
  }, {} as ProviderTimings);

const ComparisonContext = createContext<ComparisonContextType | undefined>(
  undefined
);

interface CustomWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

export const ComparisonProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const providers = [...ALL_PROVIDERS_LIST];
  const [recordingState, setRecordingState] =
    useState<AudioRecordingState>("idle");
  const [providerOutputs, setProviderOutputs] = useState<ProviderOutputs>(() =>
    initializeProviderOutputs(providers)
  );
  const [providerTimings, setProviderTimings] = useState<ProviderTimings>(() =>
    initializeProviderTimings(providers)
  );
  const [appError, setAppError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(true);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState<
    string | null
  >(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // One player for the whole app: speech-to-speech runs a single provider, so
  // there is never more than one voice to render.
  const playerRef = useRef<PcmPlayer>(new PcmPlayer());
  const duckedRef = useRef(false);
  const sessionDoneRef = useRef<Set<ProviderName>>(new Set());
  const endInputTimerRef = useRef<number | null>(null);
  const playerStopTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<
    MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null
  >(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const fileAudioContextRef = useRef<AudioContext | null>(null);
  const fileSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeProvidersRef = useRef<ProviderName[]>([]);
  const recordingStateRef = useRef(recordingState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const { settings, getSettingsAsUrlParams } = useUrlSettings();

  const resetProviderOutputs = useCallback(
    (providersToReset: ProviderName[]) => {
      setProviderOutputs((prev) => {
        const newState = { ...prev };
        providersToReset.forEach((p) => {
          newState[p] = {
            statusMessage: "",
            finalParts: [],
            nonFinalParts: [],
            error: "",
            infoMessages: [],
          };
        });
        return newState;
      });
    },
    []
  );

  const clearTranscriptOutputs = () => {
    setProviderOutputs(
      providers.reduce((acc, provider) => {
        acc[provider] = {
          finalParts: [],
          nonFinalParts: [],
          error: "",
          statusMessage: "",
          infoMessages: [],
        };
        return acc;
      }, {} as ProviderOutputs)
    );
    setProviderTimings(initializeProviderTimings(providers));
    setAppError(null);
  };

  /** Tear down mic/file capture. Leaves the socket and the player alone. */
  const teardownCapture = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current.disconnect();
      if (!fileAudioContextRef.current) {
        analyserRef.current = null;
      }
    }

    if (audioContextRef.current && !fileAudioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    }
  }, []);

  const stopRecordingInternal = useCallback(
    (drainAudio = false) => {
      setRecordingState("stopping");

      if (endInputTimerRef.current !== null) {
        clearTimeout(endInputTimerRef.current);
        endInputTimerRef.current = null;
      }

      const player = playerRef.current;
      // Stop is meant to cut everything immediately. Only a provider-signalled
      // end-of-session gets to let the queued tail finish.
      if (!drainAudio) player.stop();
      // Translated speech is scheduled ahead of real time, so closing the
      // AudioContext now would cut off whatever is still queued.
      const stopPlayerAfterDrain = () => {
        const remaining = player.remainingMs();
        if (remaining > 0) {
          playerStopTimerRef.current = window.setTimeout(
            () => player.stop(),
            remaining + 100
          );
        } else {
          player.stop();
        }
      };

      duckedRef.current = false;
      sessionDoneRef.current = new Set();

      teardownCapture();
      if (audioRef.current) audioRef.current.volume = 1;

      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;

        // Detach lifecycle handlers immediately, but keep `onmessage` so we can
        // still receive translations that providers flush in response to "END".
        ws.onclose = null;
        ws.onerror = null;
        ws.onopen = null;

        const closeSocket = () => {
          ws.onmessage = null;
          if (
            ws.readyState !== WebSocket.CLOSING &&
            ws.readyState !== WebSocket.CLOSED
          ) {
            ws.close();
          }
          if (drainAudio) stopPlayerAfterDrain();
        };

        if (ws.readyState === WebSocket.OPEN) {
          ws.send("END");
          // Give providers a moment to flush their final translation.
          setTimeout(closeSocket, WS_DRAIN_MS);
        } else {
          closeSocket();
        }
      } else if (drainAudio) {
        stopPlayerAfterDrain();
      }

      // Clear "Recording..." on stop. Like the STT app, we do NOT promote
      // trailing partials here: after "END" the providers flush their finalized
      // tail over the socket (kept open for WS_DRAIN_MS), which arrives as a
      // normal final. Promoting here would double Soniox's re-emitted tail.
      setProviderOutputs((prev) => {
        const newState = { ...prev };
        Object.keys(newState).forEach((key) => {
          newState[key as ProviderName] = {
            ...newState[key as ProviderName],
            statusMessage: "",
          };
        });
        return newState;
      });
      activeProvidersRef.current = [];
      setRecordingState("idle");
    },
    [teardownCapture]
  );

  /**
   * The source audio ran out, but the providers haven't finished talking.
   *
   * Stop capturing and tell the backend no more audio is coming, then wait for
   * every provider's `session_done` before tearing the socket down — a
   * speech-to-speech provider keeps synthesizing for many seconds after its last
   * input frame, and closing early would truncate the translated speech.
   */
  const endInput = useCallback(() => {
    if (recordingStateRef.current !== "recording") return;
    setRecordingState("stopping");
    teardownCapture();

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send("END");

    // Safety net: a provider that never reports `session_done` must not wedge
    // the UI in "stopping" forever.
    endInputTimerRef.current = window.setTimeout(
      () => stopRecordingInternal(true),
      SESSION_DONE_TIMEOUT_MS
    );
  }, [teardownCapture, stopRecordingInternal]);

  const setAudio = (audioUrl: string, fileName?: string) => {
    clearAudio();

    const audio = new Audio(audioUrl);
    audio.volume = 1;
    audio.crossOrigin = "anonymous";
    setAudioReady(false);
    setSelectedAudioFileName(fileName || null);

    try {
      const CustomAudioContext =
        window.AudioContext || (window as CustomWindow).webkitAudioContext;
      if (!CustomAudioContext) {
        throw new Error("AudioContext is not supported in this browser.");
      }
      const context = new CustomAudioContext();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);

      fileAudioContextRef.current = context;
      fileSourceNodeRef.current = source;
      analyserRef.current = analyser;
    } catch (err) {
      console.error("Failed to create AudioContext for file:", err);
      setAppError("Error initializing audio processing for the file.");
      return;
    }

    audio.oncanplaythrough = () => setAudioReady(true);
    audio.onerror = () => {
      setAppError("Error loading audio file.");
      setAudioReady(true);
    };

    // When previewing (i.e. not running a transcription session), tear down the
    // audible analyser -> destination path once playback stops so it can't
    // double up when a real session starts later.
    const teardownPreviewOutput = () => {
      if (recordingStateRef.current === "idle" && analyserRef.current) {
        try {
          analyserRef.current.disconnect();
        } catch (e) {
          console.warn("Error disconnecting analyser after preview:", e);
        }
      }
    };
    audio.addEventListener("pause", teardownPreviewOutput);
    audio.addEventListener("ended", teardownPreviewOutput);

    audioRef.current = audio;

    if (audioUrl.startsWith("blob:")) {
      objectUrlRef.current = audioUrl;
    }
  };

  const clearAudio = () => {
    if (recordingState !== "idle") {
      stopRecordingInternal();
    }

    if (audioRef.current) {
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      try {
        audioRef.current.load();
      } catch (e) {
        console.warn("Error during audio.load() in clearAudio:", e);
      }
    }

    if (fileAudioContextRef.current) {
      if (fileAudioContextRef.current.state !== "closed") {
        fileAudioContextRef.current.close().catch(console.error);
      }
      fileAudioContextRef.current = null;
      fileSourceNodeRef.current = null;
      analyserRef.current = null;
    }

    audioRef.current = null;
    setAudioReady(true);
    setSelectedAudioFileName(null);
    setAppError(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  // Locally play/pause the selected audio file as a preview, without opening a
  // websocket or starting a transcription session.
  const togglePreview = useCallback(async () => {
    const audio = audioRef.current;
    const context = fileAudioContextRef.current;
    const source = fileSourceNodeRef.current;
    const analyser = analyserRef.current;

    if (!audio || !context || !source || !analyser) return;
    // Ignore preview toggles while a real session is active.
    if (recordingStateRef.current !== "idle") return;

    if (!audio.paused) {
      audio.pause();
      return;
    }

    try {
      // MediaElementSource diverts the audio away from the speakers, so route
      // source -> analyser -> destination to make the preview audible.
      source.disconnect();
      source.connect(analyser);
      analyser.disconnect();
      analyser.connect(context.destination);

      if (context.state === "suspended") {
        await context.resume();
      }
      await audio.play();
    } catch (err) {
      console.error("Audio preview failed:", err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingState !== "idle") {
      console.warn("Recording already in progress or starting/stopping.");
      return;
    }
    setRecordingState("starting");
    setAppError(null);

    // The previous session may still be draining its last chunks. Cut it now:
    // left alone, its deferred stop would fire mid-session and close the
    // context this session is about to prime.
    if (playerStopTimerRef.current !== null) {
      clearTimeout(playerStopTimerRef.current);
      playerStopTimerRef.current = null;
    }
    playerRef.current.stop();
    // Must happen inside the click gesture: an AudioContext created later
    // starts suspended and silently drops every chunk we schedule.
    if (settings.mode === "s2s") {
      playerRef.current.prime();
    }
    duckedRef.current = false;
    sessionDoneRef.current = new Set();

    const currentProviders = activeProviders(settings);
    activeProvidersRef.current = currentProviders;
    resetProviderOutputs(currentProviders);
    setProviderTimings(initializeProviderTimings([...ALL_PROVIDERS_LIST]));

    setProviderOutputs((prev) => {
      const newState = { ...prev };
      currentProviders.forEach((p) => {
        newState[p] = {
          statusMessage: "Initializing...",
          finalParts: [],
          nonFinalParts: [],
          error: "",
          infoMessages: [],
        };
      });
      return newState;
    });

    try {
      const CustomAudioContext =
        window.AudioContext || (window as CustomWindow).webkitAudioContext;
      if (!CustomAudioContext) throw new Error("AudioContext not supported.");

      if (audioRef.current) {
        audioContextRef.current = fileAudioContextRef.current;
        sourceNodeRef.current = fileSourceNodeRef.current;

        // stopRecordingInternal() disconnects the source node, severing the
        // source -> analyser connection, so re-establish it on every start.
        if (fileSourceNodeRef.current && analyserRef.current) {
          fileSourceNodeRef.current.connect(analyserRef.current);
        }
      } else {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "The MediaDevices API is not available in this browser. Please ensure you are running in a secure context (HTTPS)."
          );
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
          },
        });
        streamRef.current = stream;
        const context = new CustomAudioContext();
        audioContextRef.current = context;
        sourceNodeRef.current = context.createMediaStreamSource(stream);

        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        sourceNodeRef.current.connect(analyser);
        analyserRef.current = analyser;
      }

      if (!audioContextRef.current || !sourceNodeRef.current) {
        throw new Error("Audio context or source failed to initialize.");
      }

      setProviderOutputs((prev) => {
        const newState = { ...prev };
        currentProviders.forEach(
          (p) => (newState[p].statusMessage = "Connecting...")
        );
        return newState;
      });
      setRecordingState("connecting");

      const wsUrl = `${
        window.location.protocol === "https:" ? "wss:" : "ws:"
      }//${
        window.location.host
      }/compare/api/compare-websocket?${getSettingsAsUrlParams()}`;
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";
      const ws = wsRef.current;

      wsRef.current.onopen = () => {
        setRecordingState("recording");
        notifyParentDemoStarted();
        setProviderOutputs((prev) => {
          const newState = { ...prev };
          currentProviders.forEach(
            (p) => (newState[p].statusMessage = "Recording...")
          );
          return newState;
        });

        const context = audioContextRef.current!;
        const source = sourceNodeRef.current!;
        const inputSampleRate = context.sampleRate;
        const targetSampleRate = 16000;

        processorNodeRef.current = context.createScriptProcessor(4096, 1, 1);
        source.connect(processorNodeRef.current);
        processorNodeRef.current.connect(context.destination);

        if (audioRef.current && analyserRef.current) {
          // Reset first so a leftover preview connection can't double the output.
          analyserRef.current.disconnect();
          analyserRef.current.connect(context.destination);
        }

        processorNodeRef.current.onaudioprocess = (e: AudioProcessingEvent) => {
          const inputData = e.inputBuffer.getChannelData(0);

          if (streamRef.current) {
            const outputData = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < outputData.length; i++) {
              outputData[i] = 0;
            }
          }

          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const resampledData = resample(
              inputData,
              inputSampleRate,
              targetSampleRate
            );
            if (resampledData.length > 0) {
              const pcmInt16 = floatTo16BitPCM(resampledData);
              wsRef.current.send(pcmInt16.buffer as ArrayBuffer);
            }
          }
        };

        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          // When the file finishes, stop feeding the backend but keep the
          // socket open until every provider reports `session_done` — they are
          // still translating, and in s2s still speaking.
          audioRef.current.onended = () => endInput();
          audioRef.current.play();
        }
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        let result;
        const rawData = event.data as string;

        try {
          result = JSON.parse(rawData);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", rawData, e);
          return;
        }

        const provider = result.provider as ProviderName;

        // After Stop this socket keeps its handler for WS_DRAIN_MS to collect
        // the tail the providers flush, but a new session may already own
        // wsRef. Only the transcript may take frames from the old socket;
        // playback and session lifecycle belong to the new one.
        const stale = ws !== wsRef.current;
        if (
          stale &&
          (result.type === "audio" ||
            result.type === "session_done" ||
            result.session_ended)
        ) {
          return;
        }

        if (
          result.session_ended &&
          recordingStateRef.current !== "idle" &&
          recordingStateRef.current !== "stopping"
        ) {
          stopRecordingInternal(true);
        }

        // Translated speech. Schedule it, and duck the source file so the two
        // voices don't talk over each other.
        if (result.type === "audio") {
          playerRef.current.play(result.pcm_b64, result.sample_rate);
          if (!duckedRef.current && audioRef.current) {
            audioRef.current.volume = DUCKED_SOURCE_VOLUME;
            duckedRef.current = true;
          }
          return;
        }

        // A provider is finished. Once every active provider has said so, wind
        // the session down, letting queued audio finish first. A provider that
        // errored (failed to connect, or died mid-session) will never report
        // `session_done`, so count it as finished too rather than holding the
        // others up for SESSION_DONE_TIMEOUT_MS.
        if (
          !stale &&
          (result.type === "session_done" ||
            (result.type === "error" && !result.session_ended))
        ) {
          sessionDoneRef.current.add(provider);
          const allDone = activeProvidersRef.current.every((p) =>
            sessionDoneRef.current.has(p)
          );
          if (allDone && recordingStateRef.current !== "idle") {
            stopRecordingInternal(true);
          }
          if (result.type === "session_done") return;
        }

        setProviderOutputs((prev) => {
          const newOutputs = { ...prev };
          const currentProviderOutput = prev[provider]
            ? { ...prev[provider] }
            : initializeProviderOutputs([provider])[provider];

          if (result.type === "info") {
            const newMessage: InfoMessage = {
              message: result.message,
              level: result.level,
            };
            currentProviderOutput.infoMessages = [
              ...(currentProviderOutput.infoMessages || []),
              newMessage,
            ];
          } else if (result.error_message) {
            currentProviderOutput.error = result.error_message;
            currentProviderOutput.statusMessage = "";
            // Session-end caps arrive as an error_message; keep the completed
            // transcript. Only genuine provider errors clear it.
            if (!result.session_ended) {
              currentProviderOutput.finalParts = [];
              currentProviderOutput.nonFinalParts = [];
            }
          } else {
            currentProviderOutput.error = "";
            if (currentProviderOutput.statusMessage) {
              currentProviderOutput.statusMessage = "";
            }
            const incomingFinalParts: TranscriptPart[] = [];
            const incomingNonFinalParts: TranscriptPart[] = [];
            (result.parts || []).forEach(
              (backendPart: BackendTranscriptPart) => {
                const frontendPart: TranscriptPart = {
                  text: backendPart.text,
                  speaker: backendPart.speaker,
                  language: backendPart.language,
                  sourceLanguage: backendPart.source_language,
                  translationStatus: backendPart.translation_status,
                  start_ms: backendPart.start_ms,
                  end_ms: backendPart.end_ms,
                  confidence: backendPart.confidence,
                };
                if (backendPart.is_final) {
                  incomingFinalParts.push(frontendPart);
                } else {
                  incomingNonFinalParts.push(frontendPart);
                }
              }
            );
            currentProviderOutput.finalParts = [
              ...(currentProviderOutput.finalParts || []),
              ...incomingFinalParts,
            ];
            currentProviderOutput.nonFinalParts = incomingNonFinalParts;
          }
          newOutputs[provider] = currentProviderOutput;
          return newOutputs;
        });

        if (stale) return;

        // Mark the provider's active window for cost estimation. Any message
        // carrying transcript parts counts as a token; the first one starts the
        // meter and every subsequent one extends it to the latest token.
        const hasTokens =
          result.type !== "info" &&
          !result.error_message &&
          Array.isArray(result.parts) &&
          result.parts.length > 0;
        if (hasTokens && provider) {
          const now = Date.now();
          setProviderTimings((prev) => {
            const existing = prev[provider] ?? {
              firstTokenAt: null,
              lastTokenAt: null,
            };
            return {
              ...prev,
              [provider]: {
                firstTokenAt: existing.firstTokenAt ?? now,
                lastTokenAt: now,
              },
            };
          });
        }
      };

      wsRef.current.onerror = () => setAppError("WebSocket connection error.");
      wsRef.current.onclose = () => {
        if (recordingStateRef.current !== "idle") {
          stopRecordingInternal();
        }
      };
    } catch (err) {
      console.error("Failed to start recording:", err);
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";
      setAppError(`Failed to start recording: ${message}`);
      stopRecordingInternal();
    }
  }, [
    settings,
    recordingState,
    stopRecordingInternal,
    endInput,
    resetProviderOutputs,
    getSettingsAsUrlParams,
  ]);

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  const stopRecording = useCallback(() => {
    if (recordingState !== "idle" && recordingState !== "stopping") {
      stopRecordingInternal();
    }
  }, [recordingState, stopRecordingInternal]);

  useEffect(() => {
    return () => {
      stopRecordingInternal();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [stopRecordingInternal]);

  const contextValue: ComparisonContextType = {
    recordingState,
    providerOutputs,
    providerTimings,
    appError,
    startRecording,
    stopRecording,
    togglePreview,
    clearTranscriptOutputs,
    setAudio,
    clearAudio,
    audioReady,
    selectedAudioFileName,
    audioRef,
    analyserRef,
  };

  return (
    <ComparisonContext.Provider value={contextValue}>
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = (): ComparisonContextType => {
  const context = useContext(ComparisonContext);
  if (context === undefined) {
    throw new Error("useComparison must be used within a ComparisonProvider");
  }
  return context;
};

function resample(
  inputBuffer: Float32Array,
  inputSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (inputSampleRate === targetSampleRate) {
    return inputBuffer;
  }
  const inputLength = inputBuffer.length;
  const outputLength = Math.floor(
    (inputLength * targetSampleRate) / inputSampleRate
  );
  if (outputLength === 0) {
    return new Float32Array(0);
  }
  const outputBuffer = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const t = (i * (inputLength - 1)) / (outputLength - 1);
    const index = Math.floor(t);
    const frac = t - index;
    const val1 = inputBuffer[index];
    const val2 = inputBuffer[index + 1];

    if (val2 === undefined) {
      outputBuffer[i] = val1;
    } else {
      outputBuffer[i] = val1 + (val2 - val1) * frac;
    }
  }
  return outputBuffer;
}
