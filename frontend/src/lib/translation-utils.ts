import type { TranslationType } from "@/hooks/use-url-settings";
import { z } from "zod";

// Zod Schemas
export const languageSchema = z.object({
  code: z.string(),
  name: z.string(),
});

export const translationTargetRuleSchema = z.object({
  exclude_source_languages: z.array(z.string()),
  source_languages: z.array(z.string()),
  target_language: z.string(),
});

export const modelInfoSchema = z.object({
  id: z.string(),
  languages: z.array(languageSchema),
  name: z.string(),
  transcription_mode: z.string(),
  translation_targets: z.array(translationTargetRuleSchema),
  two_way_translation_pairs: z.array(z.string()),
});

export type Language = z.infer<typeof languageSchema>;
export type TranslationTargetRule = z.infer<typeof translationTargetRuleSchema>;
export type ModelInfo = z.infer<typeof modelInfoSchema>;

export function getAllLanguagesForModel(model: ModelInfo | null): Language[] {
  return model ? model.languages : [];
}

export function getLanguageNameByCode(
  model: ModelInfo | null,
  code: string
): string {
  if (code === "*") return "Any Language (AUTO)";
  if (code === "AUTO") return "Multilingual (auto-detect)"; // For STT language hint
  if (!model) return code; // Fallback to code if no model
  const lang = model.languages.find((l) => l.code === code);
  return lang?.name || code; // Fallback to code if name not found in model
}

export function getAvailableTargetLanguagesForModel(
  model: ModelInfo | null
): Language[] {
  if (!model) return [];

  const targetLangCodes = new Set<string>();
  model.translation_targets.forEach((rule) =>
    targetLangCodes.add(rule.target_language)
  );
  model.two_way_translation_pairs.forEach((pair) => {
    const [lang1, lang2] = pair.split(":");
    targetLangCodes.add(lang1);
    targetLangCodes.add(lang2);
  });

  return Array.from(targetLangCodes)
    .map((langCode) => ({
      code: langCode,
      name: getLanguageNameByCode(model, langCode), // Pass model here
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableSourceLanguagesForModel(
  model: ModelInfo | null,
  targetLanguage: string,
  translationType: TranslationType
): Language[] {
  if (!model || !targetLanguage) return [];

  const availableSourceLangCodes = new Set<string>();

  if (translationType === "one_way") {
    const applicableRule = model.translation_targets.find(
      (rule) => rule.target_language === targetLanguage
    );
    if (applicableRule) {
      if (applicableRule.source_languages.includes("*")) {
        model.languages.forEach((lang) => {
          availableSourceLangCodes.add(lang.code);
        });
      } else {
        applicableRule.source_languages.forEach((code) => {
          availableSourceLangCodes.add(code);
        });
      }
    }
    console.log(applicableRule);
  } else {
    // two-way
    model.two_way_translation_pairs.forEach((pair) => {
      const [lang1, lang2] = pair.split(":");
      if (lang1 === targetLanguage) {
        availableSourceLangCodes.add(lang2);
      }
      if (lang2 === targetLanguage) {
        availableSourceLangCodes.add(lang1);
      }
    });
  }

  return Array.from(availableSourceLangCodes)
    .map((code) => ({
      code,
      name: getLanguageNameByCode(model, code), // Pass model here
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getUniqueLanguagesFromTwoWayPairs(
  model: ModelInfo | null
): Language[] {
  if (!model || !model.two_way_translation_pairs) return [];

  const uniqueLangCodes = new Set<string>();
  model.two_way_translation_pairs.forEach((pair) => {
    const [lang1, lang2] = pair.split(":");
    if (lang1) uniqueLangCodes.add(lang1);
    if (lang2) uniqueLangCodes.add(lang2);
  });

  return Array.from(uniqueLangCodes)
    .map((code) => ({
      code,
      name: getLanguageNameByCode(model, code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPartnerLanguagesForTwoWay(
  model: ModelInfo | null,
  langCode: string
): Language[] {
  if (!model || !model.two_way_translation_pairs || !langCode) return [];

  const partnerLangCodes = new Set<string>();
  model.two_way_translation_pairs.forEach((pair) => {
    const [lang1, lang2] = pair.split(":");
    if (lang1 === langCode && lang2) {
      partnerLangCodes.add(lang2);
    } else if (lang2 === langCode && lang1) {
      partnerLangCodes.add(lang1);
    }
  });

  return Array.from(partnerLangCodes)
    .map((code) => ({
      code,
      name: getLanguageNameByCode(model, code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
