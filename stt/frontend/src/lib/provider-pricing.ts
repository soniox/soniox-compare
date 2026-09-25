import { ALL_PROVIDERS_LIST, type ProviderName } from "./provider-features";

export interface ProviderPricing {
  // Cost in USD for one hour of transcribed audio, with no optional features
  // asked for. Used to estimate the running session cost shown in each
  // provider card header.
  pricePerHour: number;
  // What a provider charges on top for a feature the session switched on.
  // Absent means the feature is included in `pricePerHour`, which is why
  // Speechmatics stays at one price while Deepgram does not.
  surcharges?: {
    diarization?: number;
    // Signed, so it can be a reduction: Deepgram's single-language model is
    // cheaper than its multilingual one, and any hint selects it.
    singleLanguageHint?: number;
  };
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
      description:
        "Billed per token, not per hour: roughly 30K audio-in tokens at " +
        "$2/1M plus 15K text-out tokens at $4/1M works out to ~$0.12/hour.",
      updatedAt: "September 2026",
    },
  },
  openai: {
    pricePerHour: 1.02,
    tooltip: {
      updatedAt: "June 2026",
    },
  },
  "openai:whisper": {
    pricePerHour: 1.02,
    tooltip: {
      description:
        "Whisper-family realtime model at the same rate as the default. It " +
        "rejects server VAD, so the transcript finalizes when the stream ends.",
      updatedAt: "September 2026",
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
    surcharges: { diarization: 0.3 },
    tooltip: {
      description:
        "Standard real-time transcription $1.00/hour plus the diarization " +
        "add-on $0.30/hour, which applies to every session because this app " +
        "always uses ConversationTranscriber. At-start language " +
        "identification is not an add-on; continuous LID is not used.",
      updatedAt: "September 2026",
    },
  },
  speechmatics: {
    pricePerHour: 0.8,
    tooltip: {
      description:
        "Real-time Enhanced on the Pro plan, list rate. Speechmatics offers " +
        "33% off for opting into model training and 20% off above 500 " +
        "hours/month; neither is applied here. Diarization and language " +
        "identification are included.",
      updatedAt: "September 2026",
    },
  },
  deepgram: {
    pricePerHour: 0.35,
    surcharges: { diarization: 0.12, singleLanguageHint: -0.06 },
    tooltip: {
      description:
        "Nova-3 streaming at $0.0058/minute multilingual, or $0.0048/minute " +
        "once a language is picked (both current promos; regular rates are " +
        "$0.0092 and $0.0077). Speaker diarization adds $0.0020/minute and is " +
        "sent by default. Keyterm prompting is not sent.",
      updatedAt: "September 2026",
    },
  },
  assembly: {
    pricePerHour: 0.45,
    surcharges: { diarization: 0.12 },
    tooltip: {
      description:
        "Universal-3.5 Pro realtime $0.45/hour plus streaming speaker " +
        "diarization $0.12/hour, which this app sends by default. Keyterms " +
        "are included on this model; general prompting is batch-only.",
      updatedAt: "September 2026",
    },
  },
  "assembly:streaming": {
    pricePerHour: 0.15,
    surcharges: { diarization: 0.12 },
    tooltip: {
      description:
        "The cheaper streaming tier: six languages instead of nineteen, and " +
        "it returns text without casing or punctuation. $0.15/hour plus the " +
        "same $0.12/hour streaming diarization.",
      updatedAt: "September 2026",
    },
  },
  cartesia: {
    pricePerHour: 0.4,
    tooltip: {
      description:
        "Scale plan: $299 for 8M credits at 3 credits per second of audio, " +
        "so ~$0.40/hour (Cartesia quotes $0.39). The Startup plan works out " +
        "to $0.42.",
      updatedAt: "September 2026",
    },
  },
  elevenlabs: {
    pricePerHour: 0.39,
    tooltip: {
      description: "Scribe v2 Realtime, $0.39/hour.",
      updatedAt: "September 2026",
    },
  },
  meta: {
    pricePerHour: 0.18,
    tooltip: {
      updatedAt: "September 2026",
    },
  },
  inworld: {
    pricePerHour: 0.15,
    tooltip: {
      description:
        "STT 1 on-demand: $0.15/hour, dropping to $0.10/hour on every paid " +
        "plan, per inworld.ai/pricing.",
      updatedAt: "September 2026",
    },
  },
  xai: {
    pricePerHour: 0.2,
    tooltip: {
      description:
        "Streaming speech-to-text: $0.20/hour, per " +
        "docs.x.ai/developers/pricing. The batch REST endpoint is $0.10/hour.",
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

export interface PricingBreakdown {
  total: number;
  base: number;
  // Each surcharge the current settings actually incur, for the tooltip.
  extras: { label: string; amount: number }[];
}

/** What this session costs per hour at `provider`, given what is switched on.
 * A provider that includes a feature has no surcharge for it, so turning the
 * feature on moves some cards and not others — which is the comparison. */
export const priceBreakdown = (
  provider: ProviderName,
  settings: { enableSpeakerDiarization?: boolean; languageHints?: string[] },
): PricingBreakdown | undefined => {
  const pricing = PROVIDER_PRICING[provider];
  if (!pricing) return undefined;

  const extras: { label: string; amount: number }[] = [];
  const diarization = pricing.surcharges?.diarization;
  if (diarization !== undefined && settings.enableSpeakerDiarization) {
    extras.push({ label: "speaker diarization", amount: diarization });
  }

  // Any hint at all, not exactly one: Deepgram accepts a single hint, so a
  // request with several is capped to the first and still bills the
  // single-language rate.
  const singleLanguage = pricing.surcharges?.singleLanguageHint;
  if (singleLanguage !== undefined && (settings.languageHints?.length ?? 0) > 0) {
    extras.push({ label: "single-language model", amount: singleLanguage });
  }

  const total = extras.reduce((sum, e) => sum + e.amount, pricing.pricePerHour);
  return { total, base: pricing.pricePerHour, extras };
};

export const getProviderPricing = (
  provider: ProviderName,
): ProviderPricing | undefined => PROVIDER_PRICING[provider];

// Sanity guard so a newly added provider doesn't silently ship without a price.
export const PRICED_PROVIDERS = ALL_PROVIDERS_LIST.filter(
  (p) => PROVIDER_PRICING[p] !== undefined,
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
