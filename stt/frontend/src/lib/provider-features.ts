// A provider key is "<provider>" or "<provider>:<variant>" for a further model
// of the same provider. The backend treats keys as opaque; here only `groupOf`
// splits them, so icon and display name are shared per provider while the model
// label, price and feature matrix stay per key.
export const ALL_PROVIDERS_LIST = [
  "soniox",
  "openai",
  "openai:whisper",
  "google",
  "azure",
  "speechmatics",
  "deepgram",
  "assembly",
  "assembly:streaming",
  "cartesia",
  "elevenlabs",
  "meta",
  "smallest",
  "xai",
  "inworld",
] as const;
export type ProviderName = (typeof ALL_PROVIDERS_LIST)[number];

// The provider a key belongs to: "openai:mini" -> "openai".
type GroupOf<K extends string> = K extends `${infer G}:${string}` ? G : K;
export type ProviderGroup = GroupOf<ProviderName>;

export const groupOf = (provider: ProviderName): ProviderGroup =>
  provider.split(":")[0] as ProviderGroup;

// Every key of a provider, in list order.
export const modelsOf = (provider: ProviderName): ProviderName[] =>
  ALL_PROVIDERS_LIST.filter((p) => groupOf(p) === groupOf(provider));

export const SONIOX_PROVIDER = ALL_PROVIDERS_LIST[0];

// Square SVG logos live in /public/provider-icons. Most follow the
// `${provider}-icon.svg` convention; `assembly` is the lone exception.
export const PROVIDER_ICON_FILES: Record<ProviderGroup, string> = {
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
  xai: "xai-icon.png",
  inworld: "inworld-icon.png",
};

export const getProviderIcon = (provider: ProviderName): string =>
  `/provider-icons/${PROVIDER_ICON_FILES[groupOf(provider)]}`;
