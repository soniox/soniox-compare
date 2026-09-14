import { ALL_PROVIDERS_LIST, type ProviderName } from "./provider-features";

export interface ProviderPricing {
  // Cost in USD for one hour of transcribed audio. Used to estimate the
  // running session cost shown in each provider card header.
  pricePerHour: number;
  tooltip: {
    // Optional explanation of how `pricePerHour` was derived (tier, model, etc).
    description?: string;
    // ISO date (YYYY-MM-DD) the figure was last checked against public pricing.
    updatedAt: string;
  };
}

// NOTE: These figures are approximations gathered from each provider's public
// pricing pages and converted to a per-hour rate. They are meant for a rough
// side-by-side estimate, not billing. Re-check the numbers (and bump
// `updatedAt`) whenever a provider changes its pricing.
export const PROVIDER_PRICING: Record<ProviderName, ProviderPricing> = {
  soniox: {
    pricePerHour: 0.12,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  openai: {
    pricePerHour: 1.02,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  google: {
    pricePerHour: 0.54,
    tooltip: {
      updatedAt: "August 2026",
    },
  },
  azure: {
    pricePerHour: 1.0,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  speechmatics: {
    pricePerHour: 0.56,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  deepgram: {
    pricePerHour: 0.35,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  assembly: {
    pricePerHour: 0.45,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  cartesia: {
    pricePerHour: 0.43,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  elevenlabs: {
    pricePerHour: 0.39,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  meta: {
    pricePerHour: 0.18,
    tooltip: {
      updatedAt: "September 2026",
    },
  },
  smallest: {
    pricePerHour: 0.24,
    tooltip: {
      description:
        "Pulse (Realtime) pay-as-you-go rate: ~$0.004/minute of streamed " +
        "audio, per smallest.ai/pricing/models.",
      updatedAt: "September 2026",
    },
  },
};

export const getProviderPricing = (
  provider: ProviderName
): ProviderPricing | undefined => PROVIDER_PRICING[provider];

// Sanity guard so a newly added provider doesn't silently ship without a price.
export const PRICED_PROVIDERS = ALL_PROVIDERS_LIST.filter(
  (p) => PROVIDER_PRICING[p] !== undefined
);

// Render the published per-hour rate, e.g. 0.96 -> "$0.96/hour".
export const formatPricePerHour = (pricePerHour: number): string =>
  `$${pricePerHour.toFixed(2)}/hour`;

// Format an estimated running cost at a fixed 4-decimal precision so the value
// stays stable as the meter ticks, e.g. "$0.0008".
export const formatEstimatedCost = (cost: number): string => {
  const safe = Number.isFinite(cost) && cost > 0 ? cost : 0;
  return `$${safe.toFixed(4)}`;
};
