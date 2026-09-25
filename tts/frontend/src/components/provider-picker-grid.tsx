import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useConfig } from "@/contexts/config-context";
import { useTts } from "@/contexts/tts-context";
import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_MODELS,
  getProviderIcon,
  groupOf,
  type ProviderName,
} from "@/lib/providers";
import { formatPricePerHour, getProviderPricing } from "@/lib/provider-pricing";
import { cn } from "@/lib/utils";

type Props = {
  providers: ProviderName[];
  onPick: (provider: ProviderName) => void;
  prefersReducedMotion: boolean;
  columns: 1 | 2;
};

export const ProviderPickerGrid = ({
  providers,
  onPick,
  prefersReducedMotion,
  columns,
}: Props) => {
  const { isLanguageSupported } = useConfig();
  const { language } = useTts();

  // One tile per provider; its other models open in a popover, because a taller
  // tile stretches its row-mate and leaves the grid ragged.
  const groups: ProviderName[][] = [];
  for (const provider of providers) {
    const group = groups.find((g) => groupOf(g[0]) === groupOf(provider));
    if (group) {
      group.push(provider);
    } else {
      groups.push([provider]);
    }
  }

  const price = (provider: ProviderName) => {
    const pricing = getProviderPricing(provider);
    if (!pricing) {
      return "";
    }
    return formatPricePerHour(pricing.pricePerHour).replace("/hour", "/h");
  };

  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {groups.map((group) => {
        // Lead with a model that works in the chosen language, so the tile
        // does not read "not supported" while a sibling behind the chevron is.
        const first =
          group.find((p) => isLanguageSupported(language, p)) ?? group[0];
        const rest = group.filter((p) => p !== first);
        const name = PROVIDER_DISPLAY_NAMES[groupOf(first)];
        const supported = isLanguageSupported(language, first);
        return (
          <div
            key={groupOf(first)}
            className="flex items-stretch rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
          >
            <motion.button
              type="button"
              onClick={() => onPick(first)}
              whileHover={prefersReducedMotion ? undefined : { scale: 0.96 }}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/70"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                <img
                  src={getProviderIcon(first)}
                  alt={`${name} logo`}
                  loading="lazy"
                  className="h-6 w-6 object-contain"
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold leading-tight text-zinc-800 dark:text-zinc-100">
                  {name}
                </span>
                <span className="truncate text-[10px] lowercase leading-tight text-zinc-400">
                  {supported
                    ? [PROVIDER_MODELS[first], price(first)]
                        .filter(Boolean)
                        .join(" · ")
                    : "language not supported"}
                </span>
              </span>
            </motion.button>
            {rest.length > 0 && (
              <Popover>
                <PopoverTrigger
                  aria-label={`Choose ${name} model, ${rest.length + 1} available`}
                  className="flex shrink-0 cursor-pointer items-center gap-0.5 border-l px-1.5 border-zinc-100 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700/70 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100"
                >
                  <span className="text-[10px] font-medium leading-none">
                    +{rest.length}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Model
                  </p>
                  {group.map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => onPick(provider)}
                      className="flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="truncate lowercase text-zinc-700 dark:text-zinc-200">
                        {PROVIDER_MODELS[provider]}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                        {isLanguageSupported(language, provider)
                          ? price(provider)
                          : "n/a"}
                      </span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
        );
      })}
    </div>
  );
};
