import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  ALL_PROVIDERS_LIST,
  type ProviderName,
} from "../lib/provider-features";
import { MockWebSocket } from "../lib/mock-websocket";
import { activeProviders, useUrlSettings } from "../hooks/use-url-settings";
import { notifyParentDemoStarted } from "../lib/embed";

const USE_MOCK_DATA = false;

// After sending "END" we keep the socket's message handler attached for a short
// window so providers that only finalize on close (e.g. Cartesia, Google) can
// flush their last transcript before we close the connection.
const WS_DRAIN_MS = 5000;

// Raw mode keeps every message a provider sent, so a chatty provider on a long
// session is capped to protect the render. The newest messages are kept.
const MAX_RAW_MESSAGES_PER_PROVIDER = 2000;

// Raw messages are buffered outside React and published on this interval, so a
// burst from a chatty provider costs one render rather than one per message.
const RAW_FLUSH_MS = 100;

export interface TranscriptPart {
  text: string;
  speaker?: number | null;
  language?: string | null;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}

export interface InfoMessage {
  message: string;
  level: "info" | "warning" | "error";
}

// A message the provider itself sent upstream, forwarded by the backend and
// shown unaggregated in raw mode. `seq` is a session-independent id, so rows
// keep their identity as the buffer drops its oldest entries. `at` is the
// arrival time, used to show how the messages were spaced out. `verbatim` is
// false when the provider's SDK parsed the message before we saw it and the
// text is our re-serialization of it rather than the frame off the wire.
export interface RawProviderMessage {
  seq: number;
  at: number;
  data: string;
  verbatim: boolean;
}

export type RawOutputs = Record<ProviderName, RawProviderMessage[]>;

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

export interface RawMessage {
  provider: ProviderName;
  data: string;
}

interface ComparisonContextState {
  recordingState: AudioRecordingState;
  providerOutputs: ProviderOutputs;
  rawOutputs: RawOutputs;
  providerTimings: ProviderTimings;
  appError: string | null;
  rawMessages: RawMessage[];
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
  clearRawMessages: () => void;
  setAudio: (audioUrl: string, fileName?: string) => void;
  clearAudio: () => void;
}

type ComparisonContextType = ComparisonContextState & ComparisonContextActions;

interface BackendTranscriptPart {
  text: string;
  is_final: boolean;
  speaker?: number | null;
  language?: string | null;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}

const emptyOutput = (statusMessage = ""): OutputData => ({
  statusMessage,
  finalParts: [],
  nonFinalParts: [],
  error: "",
  infoMessages: [],
});

const initializeProviderOutputs = (
  providers: ProviderName[]
): ProviderOutputs =>
  providers.reduce((acc, provider) => {
    acc[provider] = emptyOutput();
    return acc;
  }, {} as ProviderOutputs);

const initializeRawOutputs = (providers: ProviderName[]): RawOutputs =>
  providers.reduce((acc, provider) => {
    acc[provider] = [];
    return acc;
  }, {} as RawOutputs);

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
  const [rawOutputs, setRawOutputs] = useState<RawOutputs>(() =>
    initializeRawOutputs(providers)
  );
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
  const [audioReady, setAudioReady] = useState(true);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState<
    string | null
  >(null);

  const wsRef = useRef<WebSocket | MockWebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<
    MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null
  >(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const fileAudioContextRef = useRef<AudioContext | null>(null);
  const fileSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const activeProvidersRef = useRef<ProviderName[]>([]);
  // Raw messages live outside React until they are actually on screen: they
  // arrive for every upstream event, and putting each one through state would
  // re-render every card even while the transcript view is up.
  const rawBufferRef = useRef<Partial<Record<ProviderName, RawProviderMessage[]>>>(
    {}
  );
  const rawDirtyRef = useRef<Set<ProviderName>>(new Set());
  const rawFlushRef = useRef<number | null>(null);
  const rawModeRef = useRef(false);
  // Never reset, so a row's identity cannot be reused by a later message.
  const rawSeqRef = useRef(0);
  const recordingStateRef = useRef(recordingState);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const { settings, getSettingsAsUrlParams } = useUrlSettings();

  const flushRawMessages = useCallback(() => {
    if (rawFlushRef.current !== null) {
      window.clearTimeout(rawFlushRef.current);
      rawFlushRef.current = null;
    }
    if (rawDirtyRef.current.size === 0) return;

    const dirty = rawDirtyRef.current;
    rawDirtyRef.current = new Set();
    setRawOutputs((prev) => {
      const next = { ...prev };
      dirty.forEach((provider) => {
        // Copied because the buffer keeps being appended to in place.
        next[provider] = [...(rawBufferRef.current[provider] || [])];
      });
      return next;
    });
  }, []);

  const appendRawMessage = useCallback(
    (provider: ProviderName, message: RawProviderMessage) => {
      const buffer = rawBufferRef.current;
      const messages = buffer[provider] || (buffer[provider] = []);
      messages.push(message);
      if (messages.length > MAX_RAW_MESSAGES_PER_PROVIDER) {
        messages.splice(0, messages.length - MAX_RAW_MESSAGES_PER_PROVIDER);
      }

      // Nothing is rendering these yet; they are published if raw mode is
      // switched on, which can happen at any point including after the session.
      if (!rawModeRef.current) return;

      rawDirtyRef.current.add(provider);
      if (rawFlushRef.current === null) {
        rawFlushRef.current = window.setTimeout(flushRawMessages, RAW_FLUSH_MS);
      }
    },
    [flushRawMessages]
  );

  const resetRawMessages = useCallback((providersToReset: ProviderName[]) => {
    providersToReset.forEach((provider) => {
      rawBufferRef.current[provider] = [];
      rawDirtyRef.current.delete(provider);
    });
    setRawOutputs((prev) => {
      const next = { ...prev };
      providersToReset.forEach((provider) => {
        next[provider] = [];
      });
      return next;
    });
  }, []);

  // Publish everything buffered so far the moment raw mode is switched on, and
  // stop publishing once it is switched off.
  useEffect(() => {
    rawModeRef.current = settings.rawMode;
    if (!settings.rawMode) return;
    (Object.keys(rawBufferRef.current) as ProviderName[]).forEach((provider) =>
      rawDirtyRef.current.add(provider)
    );
    flushRawMessages();
  }, [settings.rawMode, flushRawMessages]);

  useEffect(
    () => () => {
      if (rawFlushRef.current !== null) {
        window.clearTimeout(rawFlushRef.current);
      }
    },
    []
  );

  const resetProviderOutputs = useCallback(
    (providersToReset: ProviderName[]) => {
      setProviderOutputs((prev) => {
        const newState = { ...prev };
        providersToReset.forEach((p) => {
          newState[p] = emptyOutput();
        });
        return newState;
      });
      resetRawMessages(providersToReset);
    },
    [resetRawMessages]
  );

  const clearTranscriptOutputs = () => {
    setProviderOutputs(initializeProviderOutputs(providers));
    resetRawMessages(providers);
    setProviderTimings(initializeProviderTimings(providers));
    setAppError(null);
  };

  const clearRawMessages = () => {
    setRawMessages([]);
  };

  const stopRecordingInternal = useCallback(() => {
    setRecordingState("stopping");

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

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;

      // Detach lifecycle handlers immediately, but keep `onmessage` so we can
      // still receive transcripts that providers flush in response to "END".
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
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send("END");
        // Give providers a moment to flush their final transcript, then close.
        setTimeout(closeSocket, WS_DRAIN_MS);
      } else {
        closeSocket();
      }
    }

    // Clear out the statusMessages from the providerOutputs (so we dont show "Recording..." when we stop)
    setProviderOutputs((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((provider) => {
        newState[provider as ProviderName].statusMessage = "";
      });
      return newState;
    });
    activeProvidersRef.current = [];
    setRecordingState("idle");
  }, []);

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

    const currentProviders: ProviderName[] = activeProviders(settings);
    activeProvidersRef.current = currentProviders;
    resetProviderOutputs(currentProviders);
    setProviderTimings(initializeProviderTimings([...ALL_PROVIDERS_LIST]));

    setProviderOutputs((prev) => {
      const newState = { ...prev };
      currentProviders.forEach((p) => {
        newState[p] = emptyOutput("Initializing...");
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

        // The stopRecordingInternal() function calls a global .disconnect() on the
        // source node, which breaks the persistent source->analyser connection
        // we re-establish that connection here every time playback starts.
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
      wsRef.current = USE_MOCK_DATA
        ? new MockWebSocket(wsUrl)
        : new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

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
          // When the file finishes playing, end the session just like pressing
          // Stop (flush providers, close socket, return to idle) so the UI does
          // not stay stuck in the "recording" state.
          audioRef.current.onended = () => {
            if (
              recordingStateRef.current !== "idle" &&
              recordingStateRef.current !== "stopping"
            ) {
              stopRecordingInternal();
            }
          };
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

        // A passthrough copy of a message that also arrives normalized, so it
        // is buffered on the side and never touches the transcript state.
        if (result.type === "raw") {
          if (provider) {
            appendRawMessage(provider, {
              seq: rawSeqRef.current++,
              at: Date.now(),
              data: String(result.raw ?? ""),
              verbatim: result.verbatim !== false,
            });
          }
          return;
        }

        // The recorder captures the normalized stream (it is what mock sessions
        // replay), so the passthrough copies above are left out of it.
        if (typeof rawData === "string" && provider) {
          setRawMessages((prevRawMessages) => [
            ...prevRawMessages,
            { provider: provider, data: rawData },
          ]);
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

        if (
          result.session_ended &&
          recordingStateRef.current !== "idle" &&
          recordingStateRef.current !== "stopping"
        ) {
          stopRecordingInternal();
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
    resetProviderOutputs,
    getSettingsAsUrlParams,
    appendRawMessage,
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
    rawOutputs,
    providerTimings,
    appError,
    rawMessages,
    startRecording,
    stopRecording,
    togglePreview,
    clearTranscriptOutputs,
    clearRawMessages,
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
