import { useQueryStates, type inferParserType } from "nuqs";
import {
  createParser,
  parseAsString,
  parseAsStringLiteral,
  parseAsArrayOf,
  parseAsBoolean,
} from "nuqs/server";

import {
  ALL_PROVIDERS_LIST,
  SONIOX_PROVIDER,
  type ProviderName,
} from "@/lib/provider-features";
import { sanitizeLanguageHintsBasic } from "@/lib/language-hints";

/** "text" renders translated text only; "s2s" also speaks it. */
export const MODES = ["text", "s2s"] as const;
export type Mode = (typeof MODES)[number];

export interface UrlSettings {
  mode: Mode;
  targetLanguage: string;
  voice: string;
  languageHints: string[];
  selectedProviders: ProviderName[];
  s2sProvider: ProviderName;
  enableSpeakerDiarization: boolean;
  enableLanguageIdentification: boolean;
  enableEndpointDetection: boolean;
}

const defaultMode: Mode = "text";
const defaultTargetLanguage = "es";
const defaultVoice = "Daniel";
const defaultLanguageHints: string[] = ["en"];

const defaultSelectedProviders: ProviderName[] = [
  ...ALL_PROVIDERS_LIST.slice(0, 3),
];
const defaultEnableSpeakerDiarization = true;
const defaultEnableLanguageIdentification = true;
const defaultEnableEndpointDetection = false;

const providerLiterals = ALL_PROVIDERS_LIST as ReadonlyArray<ProviderName>;

const baseProvidersParser = parseAsArrayOf(
  parseAsStringLiteral(providerLiterals),
);

const sanitizeProviders = (providers: ProviderName[]): ProviderName[] => {
  const unique = [...new Set(providers)];
  return unique.length > 0 ? unique : defaultSelectedProviders;
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
  mode: parseAsStringLiteral(MODES).withDefault(defaultMode),
  targetLanguage: parseAsString.withDefault(defaultTargetLanguage),
  voice: parseAsString.withDefault(defaultVoice),
  languageHints: languageHintsParser,
  selectedProviders: selectedProvidersParser,
  s2sProvider:
    parseAsStringLiteral(providerLiterals).withDefault(SONIOX_PROVIDER),
  enableSpeakerDiarization: parseAsBoolean.withDefault(
    defaultEnableSpeakerDiarization,
  ),
  enableLanguageIdentification: parseAsBoolean.withDefault(
    defaultEnableLanguageIdentification,
  ),
  enableEndpointDetection: parseAsBoolean.withDefault(
    defaultEnableEndpointDetection,
  ),
};

export type ParsedUrlSettings = inferParserType<typeof settingParsers>;

/**
 * Providers that will actually run, in the order their cards appear.
 *
 * Speech-to-speech is single-provider: N providers all streaming translated
 * audio at once would talk over each other, so s2s runs the dedicated
 * `s2sProvider` selection (Soniox by default).
 */
export function activeProviders(settings: ParsedUrlSettings): ProviderName[] {
  if (settings.mode === "s2s") {
    return [settings.s2sProvider ?? SONIOX_PROVIDER];
  }
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

    params.set("mode", settings.mode);
    params.set("target_language", settings.targetLanguage || "");
    params.set("voice", settings.mode === "s2s" ? settings.voice || "" : "");

    sanitizeLanguageHintsBasic(settings.languageHints || []).forEach((hint) =>
      params.append("language_hints", hint),
    );

    params.set(
      "enable_speaker_diarization",
      String(settings.enableSpeakerDiarization),
    );
    params.set(
      "enable_language_identification",
      String(settings.enableLanguageIdentification),
    );
    params.set(
      "enable_endpoint_detection",
      String(settings.enableEndpointDetection),
    );

    activeProviders(settings).forEach((p) => params.append("providers", p));

    return params.toString();
  };

  return {
    settings,
    setSettings,
    setMode: (mode: Mode) => setSettings({ mode }),
    setTargetLanguage: (code: string) => setSettings({ targetLanguage: code }),
    setVoice: (voice: string) => setSettings({ voice }),
    setLanguageHints: (hints: string[]) =>
      setSettings({ languageHints: sanitizeLanguageHintsBasic(hints) }),
    setSelectedProviders: (providers: ProviderName[]) =>
      setSettings({ selectedProviders: providers }),
    setS2sProvider: (provider: ProviderName) =>
      setSettings({ s2sProvider: provider }),
    setEnableSpeakerDiarization: (enabled: boolean) =>
      setSettings({ enableSpeakerDiarization: enabled }),
    setEnableLanguageIdentification: (enabled: boolean) =>
      setSettings({ enableLanguageIdentification: enabled }),
    setEnableEndpointDetection: (enabled: boolean) =>
      setSettings({ enableEndpointDetection: enabled }),
    getSettingsAsUrlParams,
  };
}
