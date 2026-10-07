import { Button } from "@/components/ui/button";
import { PlayCircle, StopCircle, Play, Pause, Mic, X } from "lucide-react";
import { useComparison } from "@/contexts/comparison-context"; // Assuming this type is exported
import { ChooseAudioFileDialog } from "./audio-picker";
import { useState, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { AudioWaveButton } from "../audio-wave-button";
import { cn } from "@/lib/utils";
import { useCanRecord, useRecorder } from "@/contexts/recorder-context";
import { RecordControlsDot } from "@/components/controls/record-controls-dot";
import { RecordControlsDownloadButton } from "@/components/controls/record-controls-download-button";
import { RecordControlsSplitMenu } from "@/components/controls/record-controls-split-menu";

export const ActionPanel = () => {
  const {
    recordingState,
    startRecording,
    stopRecording,
    selectedAudioFileName,
    audioReady,
  } = useComparison();
  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";
  const isStopping = recordingState === "stopping";
  const isConnecting = recordingState === "connecting";

  const hasAudioFile = !!selectedAudioFileName;
  const canStart = !hasAudioFile || audioReady;
  const recorder = useRecorder();
  const canRecord = useCanRecord();

  return (
    <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      {hasAudioFile && <AudioFileControls />}
      <div className="flex items-center justify-end gap-2 sm:gap-3">
        <ChooseAudioFileDialog />
        <div className="flex flex-1 items-center sm:flex-initial">
          <AudioWaveButton
            onClick={
              recorder.isAwaitingSession
                ? recorder.stop
                : isRecording
                  ? stopRecording
                  : canStart
                    ? startRecording
                    : () => {}
            }
            variant={isRecording ? "destructive" : "default"}
            className={cn(
              "shrink-0 px-5 flex-1 min-w-40 sm:flex-initial",
              canRecord && "rounded-r-none",
              isRecording ? "" : "bg-soniox",
            )}
            disabled={
              !recorder.isAwaitingSession &&
              (isStarting ||
                isStopping ||
                (hasAudioFile && !audioReady && !isRecording))
            }
          >
            {recorder.isAwaitingSession ? (
              <div className="flex flex-row items-center gap-x-2 leading-none">
                <RecordControlsDot />
                <span className="text-[15px] font-semibold tracking-tight">
                  Stop recording
                </span>
              </div>
            ) : isRecording ? (
              <div className="flex flex-row items-center gap-x-2 leading-none">
                <StopCircle className="size-[18px] shrink-0" />
                <span className="text-[15px] font-semibold tracking-tight">
                  {isConnecting
                    ? "Connecting..."
                    : isStarting
                      ? "Starting..."
                      : "Stop"}
                </span>
              </div>
            ) : hasAudioFile ? (
              <div className="flex flex-row items-center gap-x-2 leading-none">
                <PlayCircle className="size-[18px] shrink-0" />
                <span className="text-[15px] font-semibold tracking-tight">
                  {audioReady ? "Play audio file" : "Loading audio..."}
                </span>
              </div>
            ) : (
              <div className="flex flex-row items-center gap-x-2 leading-none">
                <Mic className="size-[18px] shrink-0" />
                <span className="text-[15px] font-semibold tracking-tight">
                  Start talking
                </span>
              </div>
            )}
          </AudioWaveButton>
          <RecordControlsSplitMenu
            label={
              hasAudioFile
                ? "Record & play audio file"
                : "Record & start talking"
            }
            play={startRecording}
            disabled={recordingState !== "idle" || !canStart}
            variant={isRecording ? "destructive" : "default"}
          />
        </div>
        <RecordControlsDownloadButton />
      </div>
    </div>
  );
};

const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

const AudioFileControls = () => {
  const {
    audioRef,
    recordingState,
    selectedAudioFileName,
    audioReady,
    togglePreview,
    clearAudio,
  } = useComparison();

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const handlePlay = () => setIsAudioPlaying(true);
    const handlePause = () => setIsAudioPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(audioElement.currentTime);
    const handleLoadedMetadata = () => setDuration(audioElement.duration);
    const handleEnded = () => {
      setIsAudioPlaying(false);
      // If stopRecording is intended to reset state after file ends, call it here
      // For now, just set playing to false. startRecording handles actual playback start.
      if (recordingState === "recording") {
        // This indicates the file played through while in "recording" (playback) mode
        // We might want to call stopRecording() to transition state properly
        // However, startRecording in the context handles the actual audio playback
        // and its stop is tied to wsRef.current.send("END") etc.
        // For pure file playback, this might need refinement in how context's stopRecording works.
      }
    };

    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("ended", handleEnded);

    // Initial state sync
    if (audioElement.duration) setDuration(audioElement.duration);
    setCurrentTime(audioElement.currentTime);
    setIsAudioPlaying(!audioElement.paused);

    return () => {
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [audioRef, selectedAudioFileName, audioReady, recordingState]);

  // Sync with overall recordingState from context
  useEffect(() => {
    if (recordingState === "recording" && selectedAudioFileName && audioReady) {
      setIsAudioPlaying(true);
    } else if (recordingState === "idle" || recordingState === "stopping") {
      setIsAudioPlaying(false);
      if (
        audioRef.current &&
        recordingState === "idle" &&
        selectedAudioFileName
      ) {
        // Reset time if playback stopped externally and it's not due to file ending
        // setCurrentTime(0); // This might be too aggressive if user manually pauses.
      }
    }
  }, [recordingState, selectedAudioFileName, audioReady, audioRef]);

  const handleTogglePlayPause = useCallback(() => {
    if (!audioRef.current || !selectedAudioFileName || !audioReady) return;

    if (recordingState === "recording") {
      // During a live session, just play/pause the underlying audio element.
      if (audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    } else {
      // Otherwise, preview the file locally without starting a session.
      togglePreview();
    }
  }, [
    audioRef,
    recordingState,
    selectedAudioFileName,
    audioReady,
    togglePreview,
  ]);

  const handleSeek = (value: number[]) => {
    if (audioRef.current && audioReady && duration > 0) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  if (!selectedAudioFileName) {
    return null;
  }

  // Determine the effective playing state for the button icon
  // isAudioPlaying is from the audio element's events
  // recordingState === "recording" is from the context
  const displayAsPlaying =
    (recordingState === "recording" || isAudioPlaying) &&
    selectedAudioFileName &&
    audioReady &&
    audioRef.current &&
    !audioRef.current.paused;

  const controlsDisabled =
    !audioReady ||
    recordingState === "starting" ||
    recordingState === "stopping" ||
    recordingState === "connecting";

  return (
    <div className="group flex items-center gap-2 w-full sm:mr-auto sm:max-w-80 min-w-0 h-9 pl-2 pr-1 bg-white border border-input rounded-md shadow-xs dark:bg-input/30">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleTogglePlayPause}
        disabled={controlsDisabled}
        className="h-6 w-6 shrink-0 rounded-full text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-700"
        aria-label={displayAsPlaying ? "Pause preview" : "Preview audio file"}
      >
        {displayAsPlaying ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 fill-current translate-x-px" />
        )}
      </Button>
      <Slider
        value={[currentTime]}
        max={duration}
        step={1}
        className="flex-1 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-range]]:bg-zinc-500 dark:[&_[data-slot=slider-range]]:bg-zinc-300 [&_[data-slot=slider-thumb]]:size-3 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-zinc-500 dark:[&_[data-slot=slider-thumb]]:border-zinc-300 [&_[data-slot=slider-thumb]]:opacity-0 [&_[data-slot=slider-thumb]]:transition-opacity group-hover:[&_[data-slot=slider-thumb]]:opacity-100 focus-within:[&_[data-slot=slider-thumb]]:opacity-100"
        onValueChange={handleSeek}
        disabled={controlsDisabled || duration === 0}
        aria-label="Audio seek bar"
      />
      <div className="text-[11px] tabular-nums shrink-0 text-muted-foreground">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={clearAudio}
        disabled={
          recordingState === "recording" ||
          recordingState === "starting" ||
          recordingState === "stopping" ||
          recordingState === "connecting"
        }
        className="h-6 w-6 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-soniox dark:text-zinc-400 dark:hover:bg-zinc-700"
        aria-label="Remove selected audio file"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
