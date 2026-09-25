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
import {
  MAX_SELECTED_PROVIDERS,
  useUrlSettings,
} from "@/hooks/use-url-settings";
import { useFeatures } from "@/contexts/feature-context";
import { useComparison } from "@/contexts/comparison-context";
import type { ProviderName } from "@/lib/provider-features";

export const AddProviderButton = () => {
  const { settings, setSelectedProviders } = useUrlSettings();
  const { selectedProviders = [] } = settings;
  const { providerFeatures, availableProviders } = useFeatures();
  const { recordingState } = useComparison();
  const prefersReducedMotion = useReducedMotion();

  const [open, setOpen] = React.useState(false);

  const isBusy =
    recordingState === "recording" ||
    recordingState === "starting" ||
    recordingState === "connecting" ||
    recordingState === "stopping";

  const remainingProviders = availableProviders.filter(
    (p) => !selectedProviders.includes(p)
  );
  const atCap = selectedProviders.length >= MAX_SELECTED_PROVIDERS;

  // Close the modal once everything has been added, and keep it shut while a
  // session is underway (the selection is locked during recording).
  React.useEffect(() => {
    if (remainingProviders.length === 0 || isBusy || atCap) {
      setOpen(false);
    }
  }, [remainingProviders.length, isBusy, atCap]);

  const handleAdd = (provider: ProviderName) => {
    if (atCap) return;
    if (!selectedProviders.includes(provider)) {
      setSelectedProviders([...selectedProviders, provider]);
    }
  };

  // Nothing left to add (or selection is locked) — hide the affordance.
  if (remainingProviders.length === 0 || isBusy) {
    return null;
  }

  // Providers remain pickable at the cap, so say why rather than vanishing.
  if (atCap) {
    return (
      <Button
        variant="outline"
        className="shrink-0"
        disabled
        title={`Comparing the maximum of ${MAX_SELECTED_PROVIDERS} providers — remove one to add another.`}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">
          Max {MAX_SELECTED_PROVIDERS} providers
        </span>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="shrink-0">
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
            providerFeatures={providerFeatures}
            onPick={handleAdd}
            prefersReducedMotion={!!prefersReducedMotion}
            columns={2}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
