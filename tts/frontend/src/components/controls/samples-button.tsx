import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTts } from "@/contexts/tts-context";
import {
  getSamplesForLanguage,
  type CompareTtsSampleType,
} from "@/lib/samples";
import { cn } from "@/lib/utils";
import {
  CalendarCheck,
  Package,
  PencilLine,
  ReceiptText,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

const SAMPLE_ICONS: Record<CompareTtsSampleType, LucideIcon> = {
  appointment: CalendarCheck,
  delivery: Package,
  billing: ReceiptText,
  contact: UserRound,
};

export const SamplesButton = () => {
  const { language, text, setText, isPlayingAll } = useTts();
  const [open, setOpen] = useState(false);

  const samples = getSamplesForLanguage(language);
  const selectedSample = samples.find((sample) => sample.text === text);
  // The trigger mirrors the active example; custom text has no example icon.
  const TriggerIcon = selectedSample
    ? SAMPLE_ICONS[selectedSample.type]
    : PencilLine;

  const disabled = isPlayingAll || samples.length === 0;

  const dropdown = (
    <Select
      value={selectedSample?.type ?? ""}
      disabled={disabled}
      onValueChange={(sampleType) => {
        const sample = samples.find((s) => s.type === sampleType);
        if (sample) setText(sample.text);
      }}
    >
      <SelectTrigger className="hidden w-fit bg-white sm:flex dark:bg-gray-950">
        <SelectValue placeholder="Custom text" />
      </SelectTrigger>
      <SelectContent className="min-w-fit">
        {samples.map((sample) => {
          const Icon = SAMPLE_ICONS[sample.type];
          return (
            <SelectItem key={sample.type} value={sample.type}>
              <Icon />
              {sample.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );

  return (
    <>
      {dropdown}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={
              selectedSample ? `Examples (${selectedSample.label})` : "Examples"
            }
            className="relative shrink-0 sm:hidden"
          >
            <TriggerIcon className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent
          showCloseButton
          overlayClassName="bg-black/10 backdrop-blur-[2px]"
          className="flex max-h-[min(85vh,760px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle className="text-lg font-semibold">
              Examples
            </DialogTitle>
            <DialogDescription>
              Pick a sample text to send to every provider.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            {samples.map((sample) => {
              const Icon = SAMPLE_ICONS[sample.type];
              const isSelected = sample === selectedSample;

              return (
                <button
                  key={sample.type}
                  type="button"
                  onClick={() => {
                    setText(sample.text);
                    setOpen(false);
                  }}
                  className={cn(
                    "group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
                    isSelected &&
                      "border-soniox bg-soniox/10 hover:bg-soniox/15",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300",
                      isSelected && "bg-soniox/15 text-soniox",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span
                      className={cn(
                        "text-sm font-semibold text-zinc-800 dark:text-zinc-100",
                        isSelected && "text-soniox",
                      )}
                    >
                      {sample.label}
                    </span>
                    <span className="line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                      {sample.text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
