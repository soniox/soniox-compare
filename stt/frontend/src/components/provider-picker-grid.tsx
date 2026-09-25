import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProviderFeatures } from "@/contexts/feature-context";
import { useLanguageSupport } from "@/hooks/use-language-support";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { groupOf, type ProviderName } from "@/lib/provider-features";
import { cn } from "@/lib/utils";
import { ProviderLogo } from "./provider-logo";

type Props = {
  providers: ProviderName[];
  providerFeatures: ProviderFeatures | null;
  onPick: (provider: ProviderName) => void;
  prefersReducedMotion: boolean;
  columns: 1 | 2;
};

export const ProviderPickerGrid = ({
  providers,
  providerFeatures,
  onPick,
  prefersReducedMotion,
  columns,
}: Props) => {
  const { getProvidersForLanguage } = useLanguageSupport();
  const { settings } = useUrlSettings();
  // With no hint every provider auto-detects, so nothing is unsupported.
  const hint = (settings.languageHints ?? [])[0];
  const supportsHint = (provider: ProviderName) =>
    !hint || getProvidersForLanguage(hint).includes(provider);

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

  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
      )}
    >
      {groups.map((group) => {
        const first = group.find(supportsHint) ?? group[0];
        const rest = group.filter((p) => p !== first);
        const name = providerFeatures?.[first]?.name ?? first;
        const supported = supportsHint(first);
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
                <ProviderLogo provider={first} name={name} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold capitalize leading-tight text-zinc-800 dark:text-zinc-100">
                  {name}
                </span>
                <span className="truncate text-[10px] lowercase leading-tight text-zinc-400">
                  {supported
                    ? (providerFeatures?.[first]?.model ?? "")
                    : "language not supported"}
                </span>
              </span>
            </motion.button>
            {rest.length > 0 && (
              <Popover>
                <PopoverTrigger
                  aria-label={`Choose ${name} model, ${rest.length + 1} available`}
                  className="flex shrink-0 cursor-pointer items-center gap-0.5 border-l border-zinc-100 px-1.5 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-700/70 dark:hover:bg-zinc-700/70 dark:hover:text-zinc-100"
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
                      className="flex w-full cursor-pointer items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span className="truncate lowercase text-zinc-700 dark:text-zinc-200">
                        {providerFeatures?.[provider]?.model ?? provider}
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
