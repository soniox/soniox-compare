import { useEffect, useMemo, useState } from "react";
import { useModeSupport } from "@/hooks/use-mode-support";
import { type ProviderName } from "@/lib/provider-features";

const displayNames = new Intl.DisplayNames(["en"], { type: "language" });

export type SourceLanguage = { code: string; name: string };

// `providers` maps each provider to the *source*-language codes (ISO-639-1) it
// accepts. A provider with no entry places no restriction on the source: it
// auto-detects and is never told the hint. `all_languages` is the union across
// the constraining providers, computed server-side.
type LanguageSupport = {
  all_languages: string[];
  providers: Partial<Record<ProviderName, string[]>>;
};

interface UseLanguageSupportResult {
  /** Returns the providers that support a given source-language code. */
  getProvidersForLanguage: (languageCode: string) => ProviderName[];
  /** Every source language at least one provider handles. */
  languages: SourceLanguage[];
  isLoading: boolean;
}

export const useLanguageSupport = (): UseLanguageSupportResult => {
  const { supportedProviders } = useModeSupport();
  const [support, setSupport] = useState<LanguageSupport["providers"]>({});
  const [codes, setCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/compare/api/language-support")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: LanguageSupport) => {
        if (cancelled) return;
        setSupport(data.providers);
        setCodes(data.all_languages);
      })
      .catch((err) => {
        console.warn("[useLanguageSupport] failed to load support data:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-index codes as Sets for O(1) lookups per language row.
  const supportSets = useMemo(() => {
    const sets = {} as Partial<Record<ProviderName, Set<string>>>;
    for (const [provider, codes] of Object.entries(support)) {
      sets[provider as ProviderName] = new Set(codes);
    }
    return sets;
  }, [support]);

  const getProvidersForLanguage = useMemo(
    () => (languageCode: string) =>
      // Only providers that can run in this mode: the ones with no translation
      // upstream at all have no entry below, and would otherwise fall through
      // the unconstrained branch and claim every language.
      supportedProviders.filter((provider) => {
        const codes = supportSets[provider];
        // No entry means the provider auto-detects and is never told the
        // source, so it places no restriction. This is deliberately the
        // opposite of the target hook, where a missing list means "nothing":
        // Gemini and OpenAI genuinely hear any language but only speak some.
        if (codes === undefined) return true;
        return codes.has(languageCode);
      }),
    [supportSets, supportedProviders]
  );

  const languages = useMemo(
    () =>
      codes.map((code) => ({
        code,
        // Intl falls back to the raw code for anything it doesn't know.
        name: displayNames.of(code) ?? code,
      })),
    [codes]
  );

  return { getProvidersForLanguage, languages, isLoading };
};
