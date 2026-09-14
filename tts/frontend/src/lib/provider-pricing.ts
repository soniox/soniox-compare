import { type ProviderName } from "./providers";

interface PricingTooltipInfo {
  description?: string;
  updatedAt: string;
}

export type ProviderPricing = {
  // USD per hour of generated speech.
  pricePerHour: number;
  tooltip: PricingTooltipInfo;
} & (
  | {
      billing: "tokens";
      // USD per 1M input text tokens.
      inputPrice: number;
      // USD per 1M output audio tokens.
      outputPrice: number;
    }
  | {
      billing: "characters";
      // USD per 1K characters of input text.
      pricePerThousandChars: number;
    }
);

export const PROVIDER_PRICING: Record<ProviderName, ProviderPricing> = {
  soniox: {
    billing: "tokens",
    inputPrice: 4.0,
    outputPrice: 21.5,
    pricePerHour: 0.7,
    tooltip: {
      updatedAt: "July 2026",
    },
  },
  openai: {
    billing: "tokens",
    inputPrice: 0.6,
    outputPrice: 12.0,
    pricePerHour: 0.9,
    tooltip: {
      description: "About $0.015 per minute of generated audio.",
      updatedAt: "July 2026",
    },
  },
  elevenlabs: {
    billing: "characters",
    pricePerThousandChars: 0.1,
    pricePerHour: 5.0,
    tooltip: {
      description: "Multilingual v2/v3.",
      updatedAt: "July 2026",
    },
  },
  google: {
    billing: "tokens",
    inputPrice: 0.5,
    outputPrice: 10.0,
    pricePerHour: 0.91,
    tooltip: {
      description: "Audio output is 25 tokens per second of generated speech.",
      updatedAt: "July 2026",
    },
  },
  cartesia: {
    billing: "characters",
    pricePerThousandChars: 0.037,
    pricePerHour: 1.85,
    tooltip: {
      description:
        "No pay-as-you-go tier; about $37 per 1M characters on the Scale " +
        "plan ($299 for 8M credits, 1 credit per character).",
      updatedAt: "July 2026",
    },
  },
  azure: {
    billing: "characters",
    pricePerThousandChars: 0.022,
    pricePerHour: 1.1,
    tooltip: {
      description:
        "Dragon HD Omni is in preview without its own price line; billed " +
        "under the Neural HD text-to-speech meter at $22 per 1M characters.",
      updatedAt: "July 2026",
    },
  },
  smallest: {
    billing: "characters",
    pricePerThousandChars: 0.0175,
    pricePerHour: 1.05,
    tooltip: {
      description:
        "Lightning v3.1: $0.175 per 10K characters, per " +
        "smallest.ai/pricing/models; converted at ~1K characters/minute.",
      updatedAt: "September 2026",
    },
  },
  smallest_pro: {
    billing: "characters",
    pricePerThousandChars: 0.0195,
    pricePerHour: 1.17,
    tooltip: {
      description:
        "Lightning v3.1 Pro: $0.195 per 10K characters, per " +
        "smallest.ai/pricing/models; converted at ~1K characters/minute.",
      updatedAt: "September 2026",
    },
  },
};

export const getProviderPricing = (
  provider: ProviderName,
): ProviderPricing | undefined => {
  const pricing = PROVIDER_PRICING[provider];
  return pricing.pricePerHour > 0 ? pricing : undefined;
};

export const formatTokenPrice = (price: number): string =>
  `$${price.toFixed(2)}`;

export const formatCharPrice = (price: number): string => {
  const rounded = price.toFixed(2);
  return `$${Number(rounded) === price ? rounded : price.toFixed(3)}`;
};

export const formatPricePerHour = (pricePerHour: number): string =>
  `$${pricePerHour.toFixed(2)}/hour`;

export const formatEstimatedCost = (cost: number): string => {
  const safe = Number.isFinite(cost) && cost > 0 ? cost : 0;
  return `$${safe.toFixed(4)}`;
};
