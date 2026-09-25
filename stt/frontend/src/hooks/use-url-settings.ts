import { useQueryStates, type inferParserType } from "nuqs";
import {
  createParser,
  parseAsString,
  parseAsStringLiteral,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsJson,
} from "nuqs/server";

import {
  ALL_PROVIDERS_LIST,
  groupOf,
  type ProviderName,
} from "@/lib/provider-features";
import { sanitizeLanguageHintsBasic } from "@/lib/language-hints";

export type ProviderOptionValue = boolean | number | string;
/** Per-provider option overrides. Holds only what the user actually changed;
 * every other key falls back to the default the provider declares. */
export type ProviderOptions = Partial<
  Record<ProviderName, Record<string, ProviderOptionValue>>
>;

export interface UrlSettings {
  languageHints: string[];
  context: string;
  selectedProviders: ProviderName[];
  enableSpeakerDiarization: boolean;
  enableLanguageIdentification: boolean;
  enableEndpointDetection: boolean;
  providerOptions: ProviderOptions;
  selectedFileName: string | null;
  rawMode: boolean;
}

const defaultLanguageHints: string[] = ["en"];
const defaultContext: string = "";

// Three different providers, not the first three keys: a `provider:model`
// variant sitting early in the list would otherwise open the grid with two
// models of the same vendor.
const defaultSelectedProviders: ProviderName[] = ALL_PROVIDERS_LIST.filter(
  (provider, index, list) =>
    list.findIndex((other) => groupOf(other) === groupOf(provider)) === index
).slice(0, 3);
const defaultEnableSpeakerDiarization = true;
const defaultEnableLanguageIdentification = true;
const defaultEnableEndpointDetection = false;

const isOptionValue = (value: unknown): value is ProviderOptionValue =>
  typeof value === "boolean" ||
  typeof value === "number" ||
  typeof value === "string";

// The server drops anything it does not declare, so this only has to keep the
// shape sane enough for the option controls to render.
const parseProviderOptions = (value: unknown): ProviderOptions => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const result: ProviderOptions = {};
  for (const [provider, options] of Object.entries(value)) {
    if (!providerLiterals.includes(provider as ProviderName)) continue;
    if (typeof options !== "object" || options === null) continue;
    const kept: Record<string, ProviderOptionValue> = {};
    for (const [key, v] of Object.entries(options)) {
      if (isOptionValue(v)) {
        kept[key] = v;
      }
    }
    if (Object.keys(kept).length > 0) {
      result[provider as ProviderName] = kept;
    }
  }
  return result;
};

const providerLiterals = ALL_PROVIDERS_LIST as ReadonlyArray<ProviderName>;

const baseProvidersParser = parseAsArrayOf(
  parseAsStringLiteral(providerLiterals)
);

// Comparing more than this at once stops being readable, and every card holds
// its own upstream session.
export const MAX_SELECTED_PROVIDERS = 7;

const sanitizeProviders = (providers: ProviderName[]): ProviderName[] => {
  const unique = [...new Set(providers)];
  const capped = unique.slice(0, MAX_SELECTED_PROVIDERS);
  return capped.length > 0 ? capped : defaultSelectedProviders;
};

const selectedProvidersParser = createParser({
  parse: (query) => sanitizeProviders(baseProvidersParser.parse(query) ?? []),
  serialize: baseProvidersParser.serialize.bind(baseProvidersParser),
  eq: baseProvidersParser.eq?.bind(baseProvidersParser),
}).withDefault(defaultSelectedProviders);

const baseLanguageHintsParser = parseAsArrayOf(parseAsString);
const languageHintsParser = createParser({
  parse: (query) =>
    sanitizeLanguageHintsBasic(baseLanguageHintsParser.parse(query) ?? []),
  serialize: baseLanguageHintsParser.serialize.bind(baseLanguageHintsParser),
  eq: baseLanguageHintsParser.eq?.bind(baseLanguageHintsParser),
}).withDefault(defaultLanguageHints);

const settingParsers = {
  languageHints: languageHintsParser,
  context: parseAsString.withDefault(defaultContext),
  selectedProviders: selectedProvidersParser,
  enableSpeakerDiarization: parseAsBoolean.withDefault(
    defaultEnableSpeakerDiarization
  ),
  enableLanguageIdentification: parseAsBoolean.withDefault(
    defaultEnableLanguageIdentification
  ),
  enableEndpointDetection: parseAsBoolean.withDefault(
    defaultEnableEndpointDetection
  ),
  providerOptions: parseAsJson(parseProviderOptions).withDefault({}),
  selectedFileName: parseAsString,
  // View-only: swaps the rendered transcript for the provider's raw messages.
  // Not forwarded to the backend, which always streams them.
  rawMode: parseAsBoolean.withDefault(false),
};

export type ParsedUrlSettings = inferParserType<typeof settingParsers>;

export function activeProviders(settings: ParsedUrlSettings): ProviderName[] {
  return sanitizeProviders(settings.selectedProviders ?? []);
}

export function useUrlSettings() {
  const [settings, setSettings] = useQueryStates(settingParsers, {
    history: "replace",
    shallow: false,
  });

  const getSettingsAsUrlParams = () => {
    const params = new URLSearchParams();
    if (!settings) return params.toString();

    sanitizeLanguageHintsBasic(settings.languageHints || []).forEach((hint) =>
      params.append("language_hints", hint)
    );

    params.set("context", settings.context || "");
    params.set(
      "enable_speaker_diarization",
      String(settings.enableSpeakerDiarization)
    );
    params.set(
      "enable_language_identification",
      String(settings.enableLanguageIdentification)
    );
    params.set(
      "enable_endpoint_detection",
      String(settings.enableEndpointDetection)
    );
    const active = activeProviders(settings);
    // Only the cards on the grid, so a provider removed later stops sending
    // its overrides.
    const options = Object.fromEntries(
      active
        .map((p) => [p, settings.providerOptions?.[p] ?? {}] as const)
        .filter(([, o]) => Object.keys(o).length > 0)
    );
    params.set("options", JSON.stringify(options));

    active.forEach((p) => params.append("providers", p));

    return params.toString();
  };

  return {
    settings,
    setSettings,
    setLanguageHints: (hints: string[]) =>
      setSettings({ languageHints: sanitizeLanguageHintsBasic(hints) }),
    setContext: (text: string) => setSettings({ context: text }),
    setSelectedProviders: (providers: ProviderName[]) =>
      setSettings({ selectedProviders: sanitizeProviders(providers) }),
    setEnableSpeakerDiarization: (enabled: boolean) =>
      setSettings({ enableSpeakerDiarization: enabled }),
    setEnableLanguageIdentification: (enabled: boolean) =>
      setSettings({ enableLanguageIdentification: enabled }),
    setEnableEndpointDetection: (enabled: boolean) =>
      setSettings({ enableEndpointDetection: enabled }),
    // `undefined` clears the override, so a value back at the provider's
    // default leaves the URL instead of being written into it.
    setProviderOption: (
      provider: ProviderName,
      key: string,
      value: ProviderOptionValue | undefined
    ) => {
      const current = settings.providerOptions ?? {};
      const forProvider = { ...(current[provider] ?? {}) };
      if (value === undefined) {
        delete forProvider[key];
      } else {
        forProvider[key] = value;
      }
      const next = { ...current, [provider]: forProvider };
      if (Object.keys(forProvider).length === 0) {
        delete next[provider];
      }
      setSettings({ providerOptions: next });
    },
    setSelectedFileName: (fileName: string | null) =>
      setSettings({ selectedFileName: fileName }),
    setRawMode: (enabled: boolean) => setSettings({ rawMode: enabled }),
    getSettingsAsUrlParams,
  };
}
