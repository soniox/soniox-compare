import { Check, ChevronDown, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProviderFeatures } from "@/contexts/feature-context";
import { useLanguageSupport } from "@/hooks/use-language-support";
import {
  MAX_SELECTED_PROVIDERS,
  useUrlSettings,
} from "@/hooks/use-url-settings";
import { modelsOf, type ProviderName } from "@/lib/provider-features";
import { cn } from "@/lib/utils";

type Props = {
  provider: ProviderName;
  providerFeatures: ProviderFeatures | null;
  disabled?: boolean;
};

/** The model line under a provider name. A provider with one model renders it
 * as plain text; with several it opens a picker that switches this card to
 * another model, or adds that model as its own card next to this one. Models
 * already on the grid are listed with a check rather than hidden, so the line
 * looks the same whatever else is on the grid. */
export const ModelSelect = ({
  provider,
  providerFeatures,
  disabled,
}: Props) => {
  const { settings, setSelectedProviders } = useUrlSettings();
  const { getProvidersForLanguage } = useLanguageSupport();
  const selectedProviders = settings.selectedProviders ?? [];
  // With no hint every provider auto-detects, so nothing is unsupported.
  const hint = (settings.languageHints ?? [])[0];
  const models = modelsOf(provider);
  // The grid holds at most MAX_SELECTED_PROVIDERS cards, and the setter
  // silently drops anything past it, so adding is off at the cap.
  const atCap = selectedProviders.length >= MAX_SELECTED_PROVIDERS;
  const label = providerFeatures?.[provider]?.model;

  if (!label) {
    return null;
  }

  if (models.length === 1) {
    return (
      <p className="truncate text-[10px] font-medium lowercase leading-tight text-zinc-400">
        {label}
      </p>
    );
  }

  const replaceWith = (model: ProviderName) =>
    setSelectedProviders(
      selectedProviders.map((p) => (p === provider ? model : p)),
    );

  const addAfter = (model: ProviderName) => {
    const at = selectedProviders.indexOf(provider);
    setSelectedProviders([
      ...selectedProviders.slice(0, at + 1),
      model,
      ...selectedProviders.slice(at + 1),
    ]);
  };

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex min-w-0 cursor-pointer items-center gap-0.5 text-[10px] font-medium lowercase leading-tight text-zinc-400 hover:text-zinc-600 disabled:cursor-default disabled:hover:text-zinc-400 dark:hover:text-zinc-200"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Model
        </p>
        {models.map((model) => {
          const isThisCard = model === provider;
          const onGrid = selectedProviders.includes(model);
          const modelUnsupported = hint
            ? !getProvidersForLanguage(hint).includes(model)
            : false;
          return (
            <div
              key={model}
              className={cn(
                "flex items-center gap-1 rounded-md pr-1 text-xs",
                isThisCard && "bg-zinc-100 dark:bg-zinc-800",
              )}
            >
              <button
                type="button"
                disabled={onGrid}
                onClick={() => replaceWith(model)}
                className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800"
              >
                <span
                  className={cn(
                    "truncate lowercase text-zinc-700 dark:text-zinc-200",
                    onGrid && !isThisCard && "text-zinc-400 dark:text-zinc-500",
                  )}
                >
                  {providerFeatures?.[model]?.model ?? model}
                </span>
                {modelUnsupported && (
                  <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-500">
                    n/a
                  </span>
                )}
              </button>
              {onGrid ? (
                <Check
                  aria-label="On the grid"
                  className="mr-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400"
                />
              ) : (
                <button
                  type="button"
                  disabled={atCap}
                  title={
                    atCap
                      ? `Comparing the maximum of ${MAX_SELECTED_PROVIDERS} providers — remove one first`
                      : "Add as its own card"
                  }
                  onClick={() => addAfter(model)}
                  className="shrink-0 cursor-pointer rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};
