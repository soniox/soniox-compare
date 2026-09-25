import React from "react";
import { Plus } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProviderPickerGrid } from "@/components/provider-picker-grid";
import { useTts } from "@/contexts/tts-context";
import { PROVIDERS, type ProviderName } from "@/lib/providers";

export const AddProviderButton = () => {
  const { selectedProviders, setSelectedProviders, isPlayingAll } = useTts();
  const prefersReducedMotion = useReducedMotion();

  const [open, setOpen] = React.useState(false);

  const remainingProviders = PROVIDERS.filter(
    (p) => !selectedProviders.includes(p),
  );

  // Close the modal once everything has been added, and keep it shut while a
  // play-all run is underway (the selection is locked during a run).
  React.useEffect(() => {
    if (remainingProviders.length === 0 || isPlayingAll) {
      setOpen(false);
    }
  }, [remainingProviders.length, isPlayingAll]);

  const handleAdd = (provider: ProviderName) => {
    if (!selectedProviders.includes(provider)) {
      setSelectedProviders([...selectedProviders, provider]);
    }
  };

  // Nothing left to add (or selection is locked) — hide the affordance.
  if (remainingProviders.length === 0 || isPlayingAll) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="shrink-0"
          aria-label="Add provider"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add provider</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(85vh,760px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">
            Add provider
          </DialogTitle>
          <DialogDescription>
            Pick a provider to add to the comparison.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ProviderPickerGrid
            providers={remainingProviders}
            onPick={handleAdd}
            prefersReducedMotion={!!prefersReducedMotion}
            columns={2}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
