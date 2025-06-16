import { Button } from "@/components/ui/button";
import { PlayCircle, StopCircle, XIcon, Play, Pause, Mic } from "lucide-react";
import { useComparison } from "@/contexts/comparison-context"; // Assuming this type is exported
import { ChooseAudioFileDialog } from "./audio-picker";
import { useState, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { AudioWaveButton } from "../audio-wave-button";

export const ActionPanel = () => {
  const {
    recordingState,
    startRecording,
    stopRecording,
    selectedAudioFileName,
    clearAudio,
    audioReady,
  } = useComparison();
  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";
  const isStopping = recordingState === "stopping";
  const isConnecting = recordingState === "connecting";

  const hasAudioFile = !!selectedAudioFileName;

  return (
    <div className="w-full flex flex-col gap-2 p-4 border-t border-gray-200">
      <div className="flex gap-2">
        <AudioWaveButton
          onClick={
            isRecording
              ? stopRecording
              : hasAudioFile && audioReady
              ? startRecording // This will now play the audio file via the context logic
              : !hasAudioFile
              ? startRecording // This will start mic recording
              : () => {} // Do nothing if file selected but not ready
          }
          variant={isRecording ? "destructive" : "default"}
          className={`flex-1 ${isRecording ? "" : "bg-soniox"}`}
          disabled={
            isStarting ||
            isStopping ||
            (hasAudioFile && !audioReady && !isRecording)
          }
        >
          {isRecording ? (
            <div className="flex flex-row items-center gap-x-2">
              <StopCircle className="w-5 h-5" />
              <span>
                {isConnecting
                  ? "Connecting..."
                  : isStarting
                  ? "Starting..."
                  : "Stop"}
              </span>
            </div>
          ) : hasAudioFile ? (
            <div className="flex flex-row items-center gap-x-2">
              <PlayCircle className="w-5 h-5" />
              <span>{audioReady ? "Play audio file" : "Loading audio..."}</span>
            </div>
          ) : (
            <div className="flex flex-row items-center gap-x-2">
              <Mic className="w-5 h-5" />
              <span>Start talking</span>
            </div>
          )}
        </AudioWaveButton>
        <ChooseAudioFileDialog disabled={hasAudioFile} />
      </div>
      {hasAudioFile && (
        <div className="flex items-center justify-between text-xs">
          <span className="truncate" title={selectedAudioFileName}>
            {selectedAudioFileName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={clearAudio}
            className="h-6 w-6 hover:text-soniox"
            aria-label="Clear selected audio file"
            disabled={isRecording || isStarting || isStopping || isConnecting}
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
      )}
      <AudioFileControls />
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
    startRecording, // To initiate playback of the audio file
    //stopRecording, // To stop playback
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
    if (!audioRef.current) return;

    if (recordingState !== "recording") {
      if (selectedAudioFileName && audioReady) {
        startRecording();
      }
    } else {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [
    audioRef,
    recordingState,
    selectedAudioFileName,
    audioReady,
    startRecording,
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

  return (
    <div className="flex items-center gap-2 p-2 bg-black/10 rounded-md">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleTogglePlayPause}
        disabled={
          !audioReady ||
          recordingState === "starting" ||
          recordingState === "stopping" ||
          recordingState === "connecting"
        }
        className="h-8 w-8"
        aria-label={displayAsPlaying ? "Pause audio file" : "Play audio file"}
      >
        {displayAsPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5" />
        )}
      </Button>
      <Slider
        value={[currentTime]}
        max={duration}
        step={1}
        className="flex-1 h-2 data-[disabled]:opacity-50"
        onValueChange={handleSeek}
        disabled={
          !audioReady ||
          duration === 0 ||
          recordingState === "starting" ||
          recordingState === "stopping" ||
          recordingState === "connecting"
        }
        aria-label="Audio seek bar"
      />
      <div className="text-xs w-[70px] text-right mr-2">
        <span>{formatTime(currentTime)}</span> /{" "}
        <span>{formatTime(duration)}</span>
      </div>
      {/* TODO: Add volume control later if needed */}
    </div>
  );
};
