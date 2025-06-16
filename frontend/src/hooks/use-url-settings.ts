import { useQueryStates, type inferParserType } from "nuqs";
import {
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
import { OPERATION_MODES } from "@/lib/comparison-constants";

export type TranslationType = "one_way" | "two_way";

export interface UrlSettings {
  mode: "stt" | "mt";
  languageHints: string[];
  context: string;
  targetTranslationLanguage: string;
  sourceTranslationLanguages: string[];
  selectedProviders: ProviderName[];
  enableSpeakerDiarization: boolean;
  enableLanguageIdentification: boolean;
  enableEndpointDetection: boolean;
  translationType: TranslationType;
  selectedFileName: string | null;
}

const defaultMode = OPERATION_MODES[0].value;
const defaultLanguageHints: string[] = ["en"];
const defaultContext: string = "";
const defaultTargetTranslationLanguage = "en";
const defaultSourceTranslationLanguages: string[] = ["*"];
const defaultTranslationLanguageA = "en";
const defaultTranslationLanguageB = "sl";

const initialComparisonProviders = ALL_PROVIDERS_LIST.filter(
  (p) => p !== SONIOX_PROVIDER
);
const defaultSelectedProviders: ProviderName[] = [
  ...initialComparisonProviders.slice(0, 2),
];
const defaultEnableSpeakerDiarization = true;
const defaultEnableLanguageIdentification = true;
const defaultEnableEndpointDetection = false;
const defaultTranslationType: TranslationType = "one_way";

const modeLiterals = OPERATION_MODES.map((m) => m.value) as ReadonlyArray<
  UrlSettings["mode"]
>;

const providerLiterals = ALL_PROVIDERS_LIST as ReadonlyArray<ProviderName>;
const translationTypeLiterals = ["one_way", "two_way"] as const;

const settingParsers = {
  mode: parseAsStringLiteral(modeLiterals).withDefault(defaultMode),
  languageHints:
    parseAsArrayOf(parseAsString).withDefault(defaultLanguageHints),
  context: parseAsString.withDefault(defaultContext),
  targetTranslationLanguage: parseAsString.withDefault(
    defaultTargetTranslationLanguage
  ),
  sourceTranslationLanguages: parseAsArrayOf(parseAsString).withDefault(
    defaultSourceTranslationLanguages
  ),
  selectedProviders: parseAsArrayOf(
    parseAsStringLiteral(providerLiterals)
  ).withDefault(defaultSelectedProviders),
  enableSpeakerDiarization: parseAsBoolean.withDefault(
    defaultEnableSpeakerDiarization
  ),
  enableLanguageIdentification: parseAsBoolean.withDefault(
    defaultEnableLanguageIdentification
  ),
  enableEndpointDetection: parseAsBoolean.withDefault(
    defaultEnableEndpointDetection
  ),
  translationType: parseAsStringLiteral(translationTypeLiterals).withDefault(
    defaultTranslationType
  ),
  translationLanguageA: parseAsString.withDefault(defaultTranslationLanguageA),
  translationLanguageB: parseAsString.withDefault(defaultTranslationLanguageB),
  selectedFileName: parseAsString,
};

export type ParsedUrlSettings = inferParserType<typeof settingParsers>;

export function useUrlSettings() {
  const [settings, setSettings] = useQueryStates(settingParsers, {
    history: "replace",
    shallow: false,
  });

  const getSettingsAsUrlParams = () => {
    const params = new URLSearchParams();
    if (!settings) return params.toString();

    params.set("mode", settings.mode);

    if (
      settings.mode !== "mt" &&
      settings.languageHints &&
      settings.languageHints.length > 0
    ) {
      settings.languageHints.forEach((hint) =>
        params.append("language_hints", hint)
      );
    }

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

    if (settings.mode === "mt") {
      params.set("translation_type", settings.translationType);
      if (settings.translationType === "one_way") {
        if (settings.targetTranslationLanguage) {
          params.set(
            "translation_target_language",
            settings.targetTranslationLanguage
          );
        }
        if (
          settings.sourceTranslationLanguages &&
          settings.sourceTranslationLanguages.length > 0
        ) {
          settings.sourceTranslationLanguages.forEach((lang) =>
            params.append("translation_source_languages", lang)
          );
        }
      } else if (settings.translationType === "two_way") {
        params.set("translation_language_a", settings.translationLanguageA);
        params.set("translation_language_b", settings.translationLanguageB);
      }
    }

    params.append("providers", "soniox");
    if (settings.selectedProviders && settings.selectedProviders.length > 0) {
      settings.selectedProviders.forEach((p) => params.append("providers", p));
    }

    return params.toString();
  };

  return {
    settings,
    setSettings,
    setMode: (mode: UrlSettings["mode"]) => setSettings({ mode }),
    setLanguageHints: (hints: string[]) =>
      setSettings({ languageHints: hints }),
    setContext: (text: string) => setSettings({ context: text }),
    setTargetTranslationLanguage: (lang: string) =>
      setSettings({ targetTranslationLanguage: lang }),
    setSourceTranslationLanguages: (langs: string[]) =>
      setSettings({ sourceTranslationLanguages: langs }),
    setSelectedProviders: (providers: ProviderName[]) =>
      setSettings({ selectedProviders: providers }),
    setEnableSpeakerDiarization: (enabled: boolean) =>
      setSettings({ enableSpeakerDiarization: enabled }),
    setEnableLanguageIdentification: (enabled: boolean) =>
      setSettings({ enableLanguageIdentification: enabled }),
    setEnableEndpointDetection: (enabled: boolean) =>
      setSettings({ enableEndpointDetection: enabled }),
    setTranslationType: (type: TranslationType) =>
      setSettings({ translationType: type }),
    setSelectedFileName: (fileName: string | null) =>
      setSettings({ selectedFileName: fileName }),
    getSettingsAsUrlParams,
    setTranslationLanguageA: (lang: string) =>
      setSettings({ translationLanguageA: lang }),
    setTranslationLanguageB: (lang: string) =>
      setSettings({ translationLanguageB: lang }),
  };
}
