import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveTooltip } from "@/components/ui/responsive-tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCanRecord, useRecorder } from "@/contexts/recorder-context";

export const RecordControlsDownloadButton = () => {
  const { lastRecording, isRecording, download } = useRecorder();
  const canRecord = useCanRecord();
  if (!canRecord || !lastRecording || isRecording) return null;

  return (
    <TooltipProvider>
      <ResponsiveTooltip content={<p>Download recording</p>}>
        <Button
          variant="outline"
          size="icon"
          onClick={download}
          aria-label="Download recording"
          className="shrink-0"
        >
          <Download />
        </Button>
      </ResponsiveTooltip>
    </TooltipProvider>
  );
};
