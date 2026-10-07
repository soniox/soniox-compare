import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_TEXT_LENGTH, useTts } from "@/contexts/tts-context";
import { cn } from "@/lib/utils";
import { useCanRecord, useRecorder } from "@/contexts/recorder-context";
import { RecordControlsDot } from "@/components/controls/record-controls-dot";
import { RecordControlsDownloadButton } from "@/components/controls/record-controls-download-button";
import { RecordControlsSplitMenu } from "@/components/controls/record-controls-split-menu";
import { Play, SkipBack, SkipForward, Square } from "lucide-react";

const SKIP_BUTTON_CLASS =
  "text-gray-400 hover:bg-zinc-100 animate-in fade-in-0 zoom-in-75 duration-200";

export const TextInput = () => {
  const {
    text,
    setText,
    isPlayingAll,
    playAll,
    stopAll,
    skipNext,
    skipPrevious,
    canSkipNext,
    canSkipPrevious,
  } = useTts();
  const recorder = useRecorder();
  const canRecord = useCanRecord();

  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
      <div className="relative min-w-0 flex-1">
        <Textarea
          value={text}
          onChange={(event) =>
            setText(event.target.value.slice(0, MAX_TEXT_LENGTH))
          }
          placeholder="Type the text you want to hear..."
          className="min-h-24 max-h-40 resize-none bg-white dark:bg-gray-950 pr-4 pb-6 text-sm"
        />
        <span
          className={cn(
            "absolute bottom-2 right-3 text-[10px] font-medium tabular-nums",
            text.length >= MAX_TEXT_LENGTH ? "text-red-500" : "text-zinc-400",
          )}
        >
          {text.length}/{MAX_TEXT_LENGTH}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isPlayingAll && (
          <Button
            size="icon"
            variant="ghost"
            onClick={skipPrevious}
            disabled={!canSkipPrevious}
            aria-label="Previous provider"
            className={SKIP_BUTTON_CLASS}
          >
            <SkipBack className="size-4 fill-current" />
          </Button>
        )}

        <div className="flex flex-1 items-center sm:flex-none">
          <Button
            onClick={
              recorder.isAwaitingSession
                ? recorder.stop
                : isPlayingAll
                  ? stopAll
                  : playAll
            }
            variant={isPlayingAll ? "destructive" : "default"}
            disabled={
              !isPlayingAll &&
              !recorder.isAwaitingSession &&
              text.trim().length === 0
            }
            className={cn(
              "flex-1 px-5 sm:flex-none sm:min-w-40",
              canRecord && "rounded-r-none",
              isPlayingAll ? "" : "bg-soniox",
            )}
          >
            <div className="flex flex-row items-center gap-x-2 leading-none">
              {recorder.isAwaitingSession ? (
                <RecordControlsDot />
              ) : isPlayingAll ? (
                <Square className="size-4 shrink-0 fill-current" />
              ) : (
                <Play className="size-4 shrink-0 fill-current" />
              )}
              <span className="text-[15px] font-semibold tracking-tight">
                {recorder.isAwaitingSession
                  ? "Stop recording"
                  : isPlayingAll
                    ? "Stop"
                    : "Play all"}
              </span>
            </div>
          </Button>
          <RecordControlsSplitMenu
            label="Record & play all"
            play={playAll}
            disabled={isPlayingAll || text.trim().length === 0}
            variant={isPlayingAll ? "destructive" : "default"}
          />
        </div>
        <RecordControlsDownloadButton />

        {isPlayingAll && (
          <Button
            size="icon"
            variant="ghost"
            onClick={skipNext}
            disabled={!canSkipNext}
            aria-label="Next provider"
            className={SKIP_BUTTON_CLASS}
          >
            <SkipForward className="size-4 fill-current" />
          </Button>
        )}
      </div>
    </div>
  );
};
