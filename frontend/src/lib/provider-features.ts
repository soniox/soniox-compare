export const ALL_PROVIDERS_LIST = [
  "soniox",
  "openai",
  "google",
  "azure",
  "speechmatics",
  "deepgram",
  "assembly",
] as const;
export type ProviderName = (typeof ALL_PROVIDERS_LIST)[number];

export const SONIOX_PROVIDER = ALL_PROVIDERS_LIST[0];
