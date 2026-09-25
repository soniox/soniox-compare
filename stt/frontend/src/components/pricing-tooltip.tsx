import {
  formatPricePerHour,
  getProviderPricing,
  type PricingBreakdown,
} from "@/lib/provider-pricing";
import type { ProviderName } from "@/lib/provider-features";

type Props = {
  provider: ProviderName;
  providerName: string;
  pricing: PricingBreakdown;
};

export const PricingTooltip = ({ provider, providerName, pricing }: Props) => {
  const declared = getProviderPricing(provider);
  return (
    <div className="flex max-w-[240px] flex-col gap-1.5 py-0.5 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
        Estimated cost
      </p>
      <p className="text-xs font-medium capitalize text-zinc-700 dark:text-zinc-200">
        {providerName} · {formatPricePerHour(pricing.total)}
      </p>
      {pricing.extras.length > 0 && (
        <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          {formatPricePerHour(pricing.base)} base
          {pricing.extras.map((extra) => (
            <span key={extra.label}>
              {extra.amount < 0 ? " − " : " + "}
              {`$${Math.abs(extra.amount).toFixed(2)}`} {extra.label}
            </span>
          ))}
        </p>
      )}
      {declared?.tooltip.description && (
        <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          {declared.tooltip.description}
        </p>
      )}
      <p className="text-[10px] leading-snug text-zinc-400 dark:text-zinc-500">
        Total is approximated based on the active transcription window. Updated{" "}
        {declared?.tooltip.updatedAt}.
      </p>
    </div>
  );
};
