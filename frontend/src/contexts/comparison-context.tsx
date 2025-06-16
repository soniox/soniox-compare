import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
// FIX: Changed alias paths to relative paths to resolve build errors.
import { type ProviderName, SONIOX_PROVIDER } from "../lib/provider-features";
import { MockWebSocket } from "../lib/mock-websocket";
import type { ProviderFeatures } from "../app";
import { useUrlSettings } from "../hooks/use-url-settings";

const USE_MOCK_DATA = false;
export interface TranscriptPart {
  text: string;
  speaker?: number | null;
  language?: string | null;
  translation_status?: "original" | "translation";
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}

export interface OutputData {
  statusMessage: string;
  finalParts: TranscriptPart[];
  nonFinalParts: TranscriptPart[];
  error: string;
}

export type ProviderOutputs = Record<ProviderName, OutputData>;

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
  providerFeatures: ProviderFeatures;
  recordingState: AudioRecordingState;
  providerOutputs: ProviderOutputs;
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
  translation_status?: "original" | "translation";
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
  };
  return providers.reduce((acc, provider) => {
    acc[provider] = { ...initialOutput };
    return acc;
  }, {} as ProviderOutputs);
};

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

export const ComparisonProvider: React.FC<{
  children: React.ReactNode;
  providers: ProviderName[];
  providerFeatures: ProviderFeatures;
}> = ({ children, providers, providerFeatures }) => {
  const [recordingState, setRecordingState] =
    useState<AudioRecordingState>("idle");
  const [providerOutputs, setProviderOutputs] = useState<ProviderOutputs>(() =>
    initializeProviderOutputs(providers)
  );
  const [appError, setAppError] = useState<string | null>(null);
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
        };
        return acc;
      }, {} as ProviderOutputs)
    );
    setAppError(null);
  };

  const clearRawMessages = () => {
    setRawMessages([]);
  };

  const stopRecordingInternal = useCallback(() => {
    setRecordingState("stopping");

    if (audioRef.current) {
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
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("END");
      }
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      if (
        wsRef.current.readyState !== WebSocket.CLOSING &&
        wsRef.current.readyState !== WebSocket.CLOSED
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

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

  const startRecording = useCallback(async () => {
    if (recordingState !== "idle") {
      console.warn("Recording already in progress or starting/stopping.");
      return;
    }
    setRecordingState("starting");
    setAppError(null);

    const currentProviders: ProviderName[] = [
      SONIOX_PROVIDER,
      ...settings.selectedProviders,
    ];
    activeProvidersRef.current = currentProviders;
    resetProviderOutputs(currentProviders);

    setProviderOutputs((prev) => {
      const newState = { ...prev };
      currentProviders.forEach((p) => {
        newState[p] = {
          statusMessage: "Initializing...",
          finalParts: [],
          nonFinalParts: [],
          error: "",
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

        // The stopRecordingInternal() function calls a global .disconnect() on the
        // source node, which breaks the persistent source->analyser connection
        // we re-establish that connection here every time playback starts.
        if (fileSourceNodeRef.current && analyserRef.current) {
          fileSourceNodeRef.current.connect(analyserRef.current);
        }
      } else {
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

          if (result.error_message) {
            currentProviderOutput.error = result.error_message;
            currentProviderOutput.statusMessage = "";
            currentProviderOutput.finalParts = [];
            currentProviderOutput.nonFinalParts = [];
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
                  translation_status: backendPart.translation_status,
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
    providerFeatures,
    recordingState,
    providerOutputs,
    appError,
    rawMessages,
    startRecording,
    stopRecording,
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
