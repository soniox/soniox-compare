import React from "react";
import { useTts } from "@/contexts/tts-context";
import { type ProviderName } from "@/lib/providers";
import {
  formatEstimatedCost,
  formatPricePerHour,
  getProviderPricing,
} from "@/lib/provider-pricing";
import { cn } from "@/lib/utils";
import { PricingTooltip } from "./pricing-tooltip";
import { ResponsiveTooltip } from "./ui/responsive-tooltip";

// How often the live cost re-computes while a clip is playing.
const TICK_MS = 250;

type Props = {
  provider: ProviderName;
  providerName: string;
  disableTooltip?: boolean;
};

export const ProviderCost = ({
  provider,
  providerName,
  disableTooltip = false,
}: Props) => {
  const { providerStates, getPlaybackSeconds } = useTts();
  const pricing = getProviderPricing(provider);

  const isLive = providerStates[provider].status === "playing";
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => setTick((tick) => tick + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [isLive]);

  const seconds = getPlaybackSeconds(provider);
  const cost = pricing ? (seconds / 3600) * pricing.pricePerHour : 0;

  const costLabel = `~${formatEstimatedCost(cost)}`;
  const priceLabel = pricing ? formatPricePerHour(pricing.pricePerHour) : "n/a";

  // Swallow pointer-down so dragging cannot be initiated from the price area and
  // hovering the price can't fight with the card's drag handle.
  const priceBlock = (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex flex-col items-end shrink-0 text-right",
        pricing && !disableTooltip && "cursor-help",
      )}
    >
      <span className="text-sm font-semibold tabular-nums leading-tight text-zinc-500 dark:text-zinc-400">
        {costLabel}
      </span>
      <span className="text-[10px] font-medium tabular-nums leading-tight text-zinc-400 dark:text-zinc-500">
        {priceLabel}
      </span>
    </div>
  );

  if (!pricing || disableTooltip) {
    return priceBlock;
  }

  return (
    <ResponsiveTooltip
      content={<PricingTooltip providerName={providerName} pricing={pricing} />}
      contentClassName="bg-white text-zinc-800 border border-zinc-200 shadow-md rounded-lg px-3 py-2.5 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
      arrowClassName="bg-white fill-white border-b border-r border-zinc-200 dark:bg-zinc-900 dark:fill-zinc-900 dark:border-zinc-700"
    >
      {priceBlock}
    </ResponsiveTooltip>
  );
};
