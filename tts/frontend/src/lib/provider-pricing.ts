import { type ProviderName } from "./providers";

interface PricingTooltipInfo {
  description?: string;
  updatedAt: string;
}

export type ProviderPricing = {
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
      description:
        "$12 per 1M audio output tokens, plus $0.60 per 1M text input " +
        "tokens. OpenAI publishes no tokens-per-second, so the hourly figure " +
        "assumes the density implied by its former $0.015/minute estimate, " +
        "which is no longer on its pricing page.",
      updatedAt: "July 2026",
    },
  },
  elevenlabs: {
    billing: "characters",
    pricePerThousandChars: 0.1,
    pricePerHour: 5.0,
    tooltip: {
      description: "Eleven v3, $0.10 per 1K characters.",
      updatedAt: "July 2026",
    },
  },
  fish: {
    billing: "characters",
    pricePerThousandChars: 0.015,
    pricePerHour: 0.75,
    tooltip: {
      description:
        "$15 per 1M UTF-8 bytes on the S2.1 Pro / S2 Pro / S1 pay-as-you-go " +
        "tier, per fish.audio; converted at ~50K characters/hour. Billed per " +
        'byte, not per character: "hello" is 5 bytes, "こんにちは" is 15.',
      updatedAt: "September 2026",
    },
  },
  inworld: {
    billing: "characters",
    pricePerThousandChars: 0.025,
    pricePerHour: 1.25,
    tooltip: {
      description:
        "Realtime TTS-2 on demand: $25 per 1M characters, falling to $20 / " +
        "$17.50 / $15 / $12.50 on the $25 / $100 / $300 / $1,500 monthly " +
        "plans, and as low as $5 on Enterprise; converted at ~50K " +
        "characters/hour.",
      updatedAt: "September 2026",
    },
  },
  xai: {
    billing: "characters",
    pricePerThousandChars: 0.015,
    pricePerHour: 0.75,
    tooltip: {
      description:
        "$15 per 1M characters, per docs.x.ai/developers/pricing; converted " +
        "at ~50K characters/hour.",
      updatedAt: "September 2026",
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
  deepgram: {
    billing: "characters",
    pricePerThousandChars: 0.03,
    pricePerHour: 1.5,
    tooltip: {
      description:
        "Aura-2 at $30 per 1M characters, per deepgram.com/pricing. The " +
        "language is part of the voice, so each language pins its own voice.",
      updatedAt: "September 2026",
    },
  },
  cartesia: {
    billing: "characters",
    pricePerThousandChars: 0.037375,
    pricePerHour: 1.87,
    tooltip: {
      description:
        "No pay-as-you-go tier; $37.38 per 1M characters on the Scale plan " +
        "($299 for 8M credits, 1 credit per character). Overage is $38/1M.",
      updatedAt: "September 2026",
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
  // smallest: {
  //   billing: "characters",
  //   pricePerThousandChars: 0.0175,
  //   pricePerHour: 0.875,
  //   tooltip: {
  //     description: "Lightning v3.1, $0.175 per 10K characters.",
  //     updatedAt: "September 2026",
  //   },
  // },
  "smallest:pro": {
    billing: "characters",
    pricePerThousandChars: 0.0195,
    pricePerHour: 0.975,
    tooltip: {
      description: "Lightning v3.1 Pro, $0.195 per 10K characters.",
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
