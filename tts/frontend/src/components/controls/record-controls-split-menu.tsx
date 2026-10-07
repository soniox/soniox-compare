import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCanRecord, useRecorder } from "@/contexts/recorder-context";
import { cn } from "@/lib/utils";
import { RecordControlsDot } from "./record-controls-dot";

type RecordControlsSplitMenuProps = {
  label: string;
  play: () => void;
  disabled?: boolean;
  /** Matches the play button it's attached to. */
  variant?: "default" | "destructive";
};

export const RecordControlsSplitMenu = ({
  label,
  play,
  disabled,
  variant = "default",
}: RecordControlsSplitMenuProps) => {
  const recorder = useRecorder();
  const canRecord = useCanRecord();
  const [open, setOpen] = useState(false);
  if (!canRecord) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          disabled={disabled || recorder.isRecording}
          aria-label="More play options"
          className={cn(
            "w-8 shrink-0 rounded-l-none border-l border-white/25 text-white",
            variant === "destructive"
              ? "bg-destructive hover:bg-destructive/90"
              : "bg-soniox hover:bg-gray-800",
          )}
        >
          <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-44 p-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            void recorder.record(play);
          }}
          className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
        >
          <RecordControlsDot className="ring-0" />
          {label}
        </button>
      </PopoverContent>
    </Popover>
  );
};
