import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useConfig } from "@/contexts/config-context";
import {
  FFT_SIZE,
  MAX_DECIBELS,
  MIN_DECIBELS,
  SMOOTHING,
} from "@/lib/audio-analysis";
import {
  PROVIDERS,
  parseSelectedProviders,
  type ProviderName,
} from "@/lib/providers";
import { getFirstSampleText } from "@/lib/samples";
import { notifyParentDemoStarted } from "@/lib/embed";

export const MAX_TEXT_LENGTH = 256;

export type PlaybackStatus =
  "idle" | "loading" | "playing" | "paused" | "error";

interface ProviderState {
  status: PlaybackStatus;
  error: string | null;
}

interface TtsContextType {
  text: string;
  setText: (text: string) => void;
  language: string;
  setLanguage: (language: string) => void;
  selectedProviders: ProviderName[];
  setSelectedProviders: (providers: ProviderName[]) => void;
  providerStates: Record<ProviderName, ProviderState>;
  play: (provider: ProviderName) => void;
  stop: (provider: ProviderName) => void;
  pause: (provider: ProviderName) => void;
  resume: (provider: ProviderName) => void;
  isPlayingAll: boolean;
  playAll: () => void;
  stopAll: () => void;
  /** Jump to the next provider in the run; ends the run past the last one. */
  skipNext: () => void;
  /** Jump to the previous provider, or restart the first one. */
  skipPrevious: () => void;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  getAnalyser: (provider: ProviderName) => AnalyserNode | null;
  getPlaybackSeconds: (provider: ProviderName) => number;
}

const TtsContext = createContext<TtsContextType | null>(null);

const initialProviderStates = Object.fromEntries(
  PROVIDERS.map((provider) => [provider, { status: "idle", error: null }]),
) as Record<ProviderName, ProviderState>;

function getInitialSettings(languages: string[]): {
  text: string;
  language: string;
  selectedProviders: ProviderName[];
} {
  const params = new URLSearchParams(window.location.search);
  const urlLanguage = params.get("language")?.split("-")[0].toLowerCase();
  const language =
    urlLanguage && languages.includes(urlLanguage) ? urlLanguage : "en";
  const text =
    params.get("text")?.slice(0, MAX_TEXT_LENGTH) ||
    getFirstSampleText(language);
  const selectedProviders = parseSelectedProviders(params.get("providers"));
  return { text, language, selectedProviders };
}

export function TtsProvider({ children }: { children: React.ReactNode }) {
  const { languages, isLanguageSupported } = useConfig();
  const [initialSettings] = useState(() => getInitialSettings(languages));
  const [text, setText] = useState(initialSettings.text);
  const [language, setLanguageState] = useState(initialSettings.language);
  const [selectedProviders, setSelectedProvidersState] = useState(
    initialSettings.selectedProviders,
  );
  const [providerStates, setProviderStates] = useState(initialProviderStates);
  const [isPlayingAll, setIsPlayingAll] = useState(false);

  const audioRefs = useRef<Partial<Record<ProviderName, HTMLAudioElement>>>({});

  // Where each provider's last clip stopped, so the cost meter keeps its
  // final value after the audio element is torn down.
  const playbackSecondsRef = useRef<Partial<Record<ProviderName, number>>>({});

  const getPlaybackSeconds = useCallback((provider: ProviderName) => {
    const audio = audioRefs.current[provider];
    return audio
      ? audio.currentTime
      : (playbackSecondsRef.current[provider] ?? 0);
  }, []);

  // Web Audio taps for the frequency visualization. One shared context —
  // browsers cap how many a page may open.
  const audioContextRef = useRef<AudioContext | null>(null);
  const tapsRef = useRef<
    Partial<Record<ProviderName, { source: AudioNode; analyser: AnalyserNode }>>
  >({});

  const getAnalyser = useCallback(
    (provider: ProviderName) => tapsRef.current[provider]?.analyser ?? null,
    [],
  );

  // Routes the element through an analyser. Once tapped, the element is only
  // audible through the graph, so a suspended context would silence it.
  const attachAnalyser = useCallback(
    (provider: ProviderName, audio: HTMLAudioElement) => {
      try {
        const context = (audioContextRef.current ??= new AudioContext());
        if (context.state === "suspended") void context.resume();

        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = SMOOTHING;
        analyser.minDecibels = MIN_DECIBELS;
        analyser.maxDecibels = MAX_DECIBELS;
        source.connect(analyser);
        analyser.connect(context.destination);
        tapsRef.current[provider] = { source, analyser };
      } catch {
        // The visualization is decorative; the element still plays untapped.
      }
    },
    [],
  );

  const detachAnalyser = useCallback((provider: ProviderName) => {
    const tap = tapsRef.current[provider];
    if (!tap) return;
    tap.source.disconnect();
    tap.analyser.disconnect();
    delete tapsRef.current[provider];
  }, []);

  // The full provider order for this run plus a cursor, rather than a shrinking
  // queue — skipping backwards needs to see what already played. Mirrored in
  // refs because playback callbacks fire outside React's render cycle.
  const [run, setRun] = useState<{ order: ProviderName[]; index: number }>({
    order: [],
    index: -1,
  });
  const runRef = useRef(run);
  const isPlayingAllRef = useRef(false);

  const setRunState = useCallback((order: ProviderName[], index: number) => {
    runRef.current = { order, index };
    setRun({ order, index });
  }, []);
  // Lets a finished clip start the next one without `play` depending on itself.
  const playRef = useRef<(provider: ProviderName) => void>(() => {});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("language", language);
    params.set("text", text);
    params.set("providers", selectedProviders.join(","));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [text, language, selectedProviders]);

  const setProviderState = useCallback(
    (provider: ProviderName, state: ProviderState) => {
      setProviderStates((previous) => ({ ...previous, [provider]: state }));
    },
    [],
  );

  const stop = useCallback(
    (provider: ProviderName) => {
      const audio = audioRefs.current[provider];
      if (audio) {
        playbackSecondsRef.current[provider] = audio.currentTime;
        // Detach handlers before tearing down so the aborted load doesn't
        // surface as a playback error.
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        delete audioRefs.current[provider];
      }
      detachAnalyser(provider);
      setProviderState(provider, { status: "idle", error: null });
    },
    [setProviderState, detachAnalyser],
  );

  const endQueue = useCallback(() => {
    setRunState([], -1);
    isPlayingAllRef.current = false;
    setIsPlayingAll(false);
  }, [setRunState]);

  // Move the cursor to `index`, or leave play-all mode when it runs off the end.
  // `play` stops whatever else is audible, so callers needn't stop first.
  const goTo = useCallback(
    (index: number) => {
      const { order } = runRef.current;
      if (index < 0 || index >= order.length) {
        endQueue();
        return;
      }
      setRunState(order, index);
      playRef.current(order[index]);
    },
    [endQueue, setRunState],
  );

  // Advance to the next queued provider, or leave play-all mode when drained.
  const playNext = useCallback(() => {
    goTo(runRef.current.index + 1);
  }, [goTo]);

  const play = useCallback(
    (provider: ProviderName) => {
      // Only one provider audible at a time — overlapping clips can't be
      // compared. Providers without active audio keep their state so error
      // messages stay visible.
      PROVIDERS.forEach((other) => {
        if (other === provider || audioRefs.current[other]) stop(other);
      });
      setProviderState(provider, { status: "loading", error: null });
      playbackSecondsRef.current[provider] = 0;

      const params = new URLSearchParams({
        text: text.trim(),
        provider,
        language,
      });
      const url = `/compare/api/tts?${params.toString()}`;

      // Point the audio element straight at the streaming endpoint so
      // playback starts as soon as the first bytes arrive.
      const audio = new Audio(url);
      audioRefs.current[provider] = audio;
      attachAnalyser(provider, audio);

      const fail = (message: string) => {
        if (audioRefs.current[provider] !== audio) return;
        playbackSecondsRef.current[provider] = audio.currentTime;
        delete audioRefs.current[provider];
        detachAnalyser(provider);
        setProviderState(provider, { status: "error", error: message });
        // Keep the run going; the error stays visible on the failed panel.
        if (isPlayingAllRef.current) playNext();
      };

      audio.onplaying = () => {
        if (audioRefs.current[provider] === audio) {
          setProviderState(provider, { status: "playing", error: null });
          notifyParentDemoStarted();
        }
      };
      audio.onended = () => {
        if (audioRefs.current[provider] === audio) {
          stop(provider);
          if (isPlayingAllRef.current) playNext();
        }
      };
      audio.onerror = () => {
        // The audio element can't expose the response body; if the request
        // failed outright, refetch to surface the backend's error message
        // (error responses return fast and aren't cached).
        if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
          fetch(url)
            .then(async (response) => {
              const data = await response.json().catch(() => null);
              fail(data?.error || `Request failed (${response.status})`);
            })
            .catch(() => fail("Request failed"));
        } else {
          fail("Playback failed");
        }
      };

      audio.play().catch((error: Error) => {
        // Network and decode failures are handled by onerror; fail() is a
        // no-op once the ref is cleared, so double-reporting is harmless.
        if (error.name === "AbortError") return;
        if (error.name === "NotAllowedError") {
          fail("Browser blocked audio playback");
        }
      });
    },
    [
      text,
      language,
      stop,
      setProviderState,
      playNext,
      attachAnalyser,
      detachAnalyser,
    ],
  );

  // Always call through the latest `play` so queued providers pick up the
  // current text and language rather than the values captured when the run began.
  useEffect(() => {
    playRef.current = play;
  }, [play]);

  const pause = useCallback(
    (provider: ProviderName) => {
      const audio = audioRefs.current[provider];
      if (!audio) return;
      audio.pause();
      setProviderState(provider, { status: "paused", error: null });
    },
    [setProviderState],
  );

  const resume = useCallback((provider: ProviderName) => {
    const audio = audioRefs.current[provider];
    if (!audio) return;
    // Tapped elements are inaudible while the context is suspended, which is
    // where the browser leaves it after a spell of no playback.
    void audioContextRef.current?.resume();
    // `onplaying` promotes this to "playing" once audio actually resumes.
    audio.play().catch(() => {});
  }, []);

  const stopAll = useCallback(() => {
    endQueue();
    PROVIDERS.forEach(stop);
  }, [endQueue, stop]);

  const playAll = useCallback(() => {
    const order = selectedProviders.filter((provider) =>
      isLanguageSupported(language, provider),
    );
    if (order.length === 0) return;

    PROVIDERS.forEach(stop);
    setRunState(order, 0);
    isPlayingAllRef.current = true;
    setIsPlayingAll(true);
    playRef.current(order[0]);
  }, [selectedProviders, language, isLanguageSupported, stop, setRunState]);

  const skipNext = useCallback(() => {
    if (!isPlayingAllRef.current) return;
    const { order, index } = runRef.current;
    // Nothing left to advance to — tear the run down rather than leaving the
    // last clip audible with an exhausted cursor.
    if (index + 1 >= order.length) stopAll();
    else goTo(index + 1);
  }, [goTo, stopAll]);

  const skipPrevious = useCallback(() => {
    if (!isPlayingAllRef.current) return;
    // Back from the first provider restarts it, as media players do.
    goTo(Math.max(0, runRef.current.index - 1));
  }, [goTo]);

  const setLanguage = useCallback(
    (newLanguage: string) => {
      endQueue();
      PROVIDERS.forEach(stop);
      setLanguageState(newLanguage);
      setText(getFirstSampleText(newLanguage));
    },
    [stop, endQueue],
  );

  // Also silences anything a dropped provider was playing. The selection is
  // locked in the UI during a play-all run, so the run's order stays valid.
  const setSelectedProviders = useCallback(
    (providers: ProviderName[]) => {
      const next = [...new Set(providers)];
      if (next.length === 0) return;
      selectedProviders
        .filter((provider) => !next.includes(provider))
        .forEach(stop);
      setSelectedProvidersState(next);
    },
    [selectedProviders, stop],
  );

  return (
    <TtsContext.Provider
      value={{
        text,
        setText,
        language,
        setLanguage,
        selectedProviders,
        setSelectedProviders,
        providerStates,
        play,
        stop,
        pause,
        resume,
        isPlayingAll,
        playAll,
        stopAll,
        skipNext,
        skipPrevious,
        canSkipNext: isPlayingAll && run.index < run.order.length - 1,
        canSkipPrevious: isPlayingAll && run.index > 0,
        getAnalyser,
        getPlaybackSeconds,
      }}
    >
      {children}
    </TtsContext.Provider>
  );
}

export function useTts(): TtsContextType {
  const context = useContext(TtsContext);
  if (!context) {
    throw new Error("useTts must be used within a TtsProvider");
  }
  return context;
}
