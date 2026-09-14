export const ALL_PROVIDERS_LIST = [
  "soniox",
  "openai",
  "google",
  "azure",
  "speechmatics",
  "deepgram",
  "assembly",
  "cartesia",
  "elevenlabs",
  "meta",
  "smallest",
] as const;
export type ProviderName = (typeof ALL_PROVIDERS_LIST)[number];

export const SONIOX_PROVIDER = ALL_PROVIDERS_LIST[0];

// Square SVG logos live in /public/provider-icons. Most follow the
// `${provider}-icon.svg` convention; `assembly` is the lone exception.
export const PROVIDER_ICON_FILES: Record<ProviderName, string> = {
  soniox: "soniox-icon.svg",
  openai: "openai-icon.svg",
  google: "google-icon.svg",
  azure: "azure-icon.svg",
  speechmatics: "speechmatics-icon.svg",
  deepgram: "deepgram-icon.svg",
  assembly: "assemblyai-icon.svg",
  cartesia: "cartesia-icon.svg",
  elevenlabs: "elevenlabs-icon.svg",
  meta: "meta-icon.svg",
  smallest: "smallest-icon.svg",
};

export const getProviderIcon = (provider: ProviderName): string =>
  `/provider-icons/${PROVIDER_ICON_FILES[provider]}`;
