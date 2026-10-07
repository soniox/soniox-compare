import type { ReactNode } from "react";
import background from "@/assets/recording-background.webp";
import { useComparison } from "@/contexts/comparison-context";
import { RecorderProvider } from "@/contexts/recorder-context";

export const SessionRecorder = ({ children }: { children: ReactNode }) => {
  const { recordingState, getRecordingAudioStreams } = useComparison();

  return (
    <RecorderProvider
      filenamePrefix="soniox-compare-translate"
      background={background}
      isSessionActive={recordingState !== "idle"}
      getAudioStreams={getRecordingAudioStreams}
    >
      {children}
    </RecorderProvider>
  );
};
