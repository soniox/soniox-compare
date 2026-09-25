import React from "react";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { type ProviderName } from "@/lib/provider-features";
import {
  formatEstimatedCost,
  formatPricePerHour,
  priceBreakdown,
} from "@/lib/provider-pricing";
import { cn } from "@/lib/utils";
import { PricingTooltip } from "./pricing-tooltip";
import { ResponsiveTooltip } from "./ui/responsive-tooltip";

// How often the live cost re-computes while a session is recording.
const TICK_MS = 250;

type Props = {
  provider: ProviderName;
  providerName: string;
  // Suppress the hover tooltip while the card is being dragged.
  disableTooltip?: boolean;
};

export const ProviderCost = ({
  provider,
  providerName,
  disableTooltip = false,
}: Props) => {
  const { providerTimings, recordingState } = useComparison();
  const { settings } = useUrlSettings();
  const pricing = priceBreakdown(provider, settings);
  const timing = providerTimings[provider];

  // The meter only runs live while audio is streaming. Once we leave the
  // "recording" state the cost freezes to the first-token -> last-token window,
  // which keeps the estimate honest (drain-time finals still extend lastTokenAt).
  const isLive = recordingState === "recording";
  const firstTokenAt = timing?.firstTokenAt ?? null;
  const lastTokenAt = timing?.lastTokenAt ?? null;

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!isLive || firstTokenAt === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [isLive, firstTokenAt]);

  const activeMs =
    firstTokenAt === null
      ? 0
      : Math.max(0, (isLive ? now : lastTokenAt ?? firstTokenAt) - firstTokenAt);

  const cost = pricing ? (activeMs / 3600000) * pricing.total : 0;

  const costLabel = `~${formatEstimatedCost(cost)}`;
  const priceLabel = pricing ? formatPricePerHour(pricing.total) : "n/a";

  // Swallow pointer-down so dragging cannot be initiated from the price area and
  // hovering the price can't fight with the card's drag handle.
  const priceBlock = (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex flex-col items-end shrink-0 text-right",
        pricing && !disableTooltip && "cursor-help"
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
      content={
        <PricingTooltip
          provider={provider}
          providerName={providerName}
          pricing={pricing}
        />
      }
      contentClassName="bg-white text-zinc-800 border border-zinc-200 shadow-md rounded-lg px-3 py-2.5 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
      arrowClassName="bg-white fill-white border-b border-r border-zinc-200 dark:bg-zinc-900 dark:fill-zinc-900 dark:border-zinc-700"
    >
      {priceBlock}
    </ResponsiveTooltip>
  );
};
