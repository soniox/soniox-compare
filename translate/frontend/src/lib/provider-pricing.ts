import { ALL_PROVIDERS_LIST, type ProviderName } from "./provider-features";
import type { Mode } from "@/hooks/use-url-settings";

export interface ProviderPricing {
  // Cost in USD for one hour of translated audio, text output only.
  pricePerHour: number;
  // Cost in USD for one hour when the translation is also spoken. Omitted for
  // providers that can't do speech-to-speech.
  pricePerHourS2S?: number;
  tooltip: {
    // Optional explanation of how the figures were derived (tier, model, etc).
    description?: string;
    // The date the figure was last checked against public pricing.
    updatedAt: string;
  };
}

export const PROVIDER_PRICING: Partial<Record<ProviderName, ProviderPricing>> =
  {
    soniox: {
      pricePerHour: 0.18,
      pricePerHourS2S: 0.88,
      tooltip: {
        description:
          "Billed per token at the same rates as transcription, with no " +
          "separate translation fee — but translation adds a second stream " +
          "of output tokens, so ~$0.18/hour against $0.12 for transcription " +
          "alone. Speech-to-speech adds tts-rt-v2 at ~$0.70/hour.",
        updatedAt: "September 2026",
      },
    },
    openai: {
      pricePerHour: 2.04,
      pricePerHourS2S: 2.04,
      tooltip: {
        description:
          "gpt-realtime-translate at $0.034/minute of audio. The model " +
          "always produces audio, so discarding it in text mode does not " +
          "reduce cost.",
        updatedAt: "July 2026",
      },
    },
    gemini: {
      pricePerHour: 2.208,
      pricePerHourS2S: 2.208,
      tooltip: {
        description:
          "gemini-3.5-live-translate-preview: $3.50/$21.00 per 1M audio tokens " +
          "in/out (25 tok/s); transcription text tokens extra. The response " +
          "modality is audio, so text mode costs the same.",
        updatedAt: "June 2026",
      },
    },
    speechmatics: {
      pricePerHour: 1.45,
      tooltip: {
        description:
          "Real-time Enhanced on the Pro plan ($0.80/hour, list rate with no " +
          "opt-in discounts) plus the translation bolt-on ($0.65/hour). No " +
          "speech-to-speech rate: the provider cannot speak the translation.",
        updatedAt: "September 2026",
      },
    },
    azure: {
      pricePerHour: 2.5,
      pricePerHourS2S: 3.25,
      tooltip: {
        description:
          "Speech translation is $2.50/audio hour and covers the source " +
          "transcript and up to 2 target languages. Speaking the translation " +
          "bills prebuilt neural TTS on top, at $15 per 1M characters " +
          "(50,000 characters per hour of speech).",
        updatedAt: "September 2026",
      },
    },
  };

export const getProviderPricing = (
  provider: ProviderName,
): ProviderPricing | undefined => PROVIDER_PRICING[provider];

export const getPricePerHour = (
  pricing: ProviderPricing,
  mode: Mode,
): number =>
  mode === "s2s"
    ? (pricing.pricePerHourS2S ?? pricing.pricePerHour)
    : pricing.pricePerHour;

export const PRICED_PROVIDERS = ALL_PROVIDERS_LIST.filter(
  (p) => PROVIDER_PRICING[p] !== undefined,
);

export const formatPricePerHour = (pricePerHour: number): string =>
  `$${pricePerHour.toFixed(2)}/hour`;

export const formatEstimatedCost = (cost: number): string => {
  const safe = Number.isFinite(cost) && cost > 0 ? cost : 0;
  return `$${safe.toFixed(4)}`;
};
