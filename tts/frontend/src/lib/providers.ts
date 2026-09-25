// A provider key is either "<provider>" or "<provider>:<variant>" for a further
// model of the same provider. The backend treats keys as opaque; here only
// `groupOf` splits them, so icon and display name are shared per provider while
// price, model label and language support stay per key.
export const PROVIDERS = [
  "soniox",
  "openai",
  "elevenlabs",
  "fish",
  "inworld",
  "xai",
  "google",
  "cartesia",
  "deepgram",
  "azure",
  // Lightning v3.1 is not listed: it 400s with LANGUAGE_NOT_ENABLED_IN_REGION
  // from our us-west-2 deployment, while v3.1 Pro works with the same key. The
  // backend provider stays wired, so this is one line to undo.
  // "smallest",
  "smallest:pro",
] as const;

export type ProviderName = (typeof PROVIDERS)[number];

// The provider a key belongs to: "smallest:pro" -> "smallest".
type GroupOf<K extends string> = K extends `${infer G}:${string}` ? G : K;
type ProviderGroup = GroupOf<ProviderName>;

export const groupOf = (provider: ProviderName): ProviderGroup =>
  provider.split(":")[0] as ProviderGroup;

export const PROVIDER_DISPLAY_NAMES: Record<ProviderGroup, string> = {
  soniox: "Soniox",
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  fish: "Fish Audio",
  inworld: "Inworld",
  xai: "xAI",
  google: "Google",
  cartesia: "Cartesia",
  deepgram: "Deepgram",
  azure: "Azure",
  smallest: "Smallest AI",
};

export const PROVIDER_MODELS: Record<ProviderName, string> = {
  soniox: "tts-rt-v2",
  openai: "gpt-4o-mini-tts",
  elevenlabs: "eleven_v3",
  fish: "s2.1-pro",
  inworld: "inworld-tts-2",
  // xAI's TTS endpoint takes no model, only a voice, so there is nothing to
  // name here. The card renders no model line.
  xai: "",
  google: "gemini-2.5-flash-tts",
  cartesia: "sonic-3.6",
  deepgram: "aura-2",
  azure: "dragon-hd-omni",
  // smallest: "lightning_v3.1",
  "smallest:pro": "lightning_v3.1_pro",
};

const PROVIDER_ICON_FILES: Record<ProviderGroup, string> = {
  soniox: "soniox-icon.svg",
  openai: "openai-icon.svg",
  elevenlabs: "elevenlabs-icon.svg",
  fish: "fish-icon.svg",
  inworld: "inworld-icon.png",
  xai: "xai-icon.png",
  google: "google-icon.svg",
  cartesia: "cartesia-icon.svg",
  deepgram: "deepgram-icon.svg",
  azure: "azure-icon.svg",
  smallest: "smallest-icon.svg",
};

export const getProviderIcon = (provider: ProviderName): string =>
  `/provider-icons/${PROVIDER_ICON_FILES[groupOf(provider)]}`;

// Every key of a provider, in list order, so the picker and the card dropdown
// can offer its other models.
export const modelsOf = (provider: ProviderName): ProviderName[] =>
  PROVIDERS.filter((p) => groupOf(p) === groupOf(provider));

export const isProviderName = (value: string): value is ProviderName =>
  (PROVIDERS as readonly string[]).includes(value);

export const DEFAULT_SELECTED_PROVIDERS: ProviderName[] = [
  ...PROVIDERS.slice(0, 3),
];

export const parseSelectedProviders = (
  value: string | null,
): ProviderName[] => {
  const unique = [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((p) => p.trim())
        .filter(isProviderName),
    ),
  ];
  return unique.length > 0 ? unique : DEFAULT_SELECTED_PROVIDERS;
};
