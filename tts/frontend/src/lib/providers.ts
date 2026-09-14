export const PROVIDERS = [
  "soniox",
  "openai",
  "elevenlabs",
  "google",
  "cartesia",
  "azure",
  "smallest",
  "smallest_pro",
] as const;

export type ProviderName = (typeof PROVIDERS)[number];

export const PROVIDER_DISPLAY_NAMES: Record<ProviderName, string> = {
  soniox: "Soniox",
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
  google: "Google",
  cartesia: "Cartesia",
  azure: "Azure",
  smallest: "Smallest AI",
  smallest_pro: "Smallest AI Pro",
};

export const PROVIDER_MODELS: Record<ProviderName, string> = {
  soniox: "tts-rt-v2",
  openai: "gpt-4o-mini-tts",
  elevenlabs: "eleven_v3",
  google: "gemini-2.5-flash-tts",
  cartesia: "sonic-3.5",
  azure: "dragon-hd-omni",
  smallest: "lightning_v3.1",
  smallest_pro: "lightning_v3.1_pro",
};

const PROVIDER_ICON_FILES: Record<ProviderName, string> = {
  soniox: "soniox-icon.svg",
  openai: "openai-icon.svg",
  elevenlabs: "elevenlabs-icon.svg",
  google: "google-icon.svg",
  cartesia: "cartesia-icon.svg",
  azure: "azure-icon.svg",
  smallest: "smallest-icon.svg",
  smallest_pro: "smallest-icon.svg",
};

export const getProviderIcon = (provider: ProviderName): string =>
  `/provider-icons/${PROVIDER_ICON_FILES[provider]}`;
