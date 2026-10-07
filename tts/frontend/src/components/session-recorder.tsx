import type { ReactNode } from "react";
import background from "@/assets/recording-background.webp";
import { RecorderProvider } from "@/contexts/recorder-context";
import { useTts } from "@/contexts/tts-context";

export const SessionRecorder = ({ children }: { children: ReactNode }) => {
  const { isPlayingAll, getRecordingAudioStreams } = useTts();

  return (
    <RecorderProvider
      filenamePrefix="soniox-compare-tts"
      background={background}
      isSessionActive={isPlayingAll}
      getAudioStreams={getRecordingAudioStreams}
    >
      {children}
    </RecorderProvider>
  );
};
