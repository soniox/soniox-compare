import { useEffect, useMemo, useState } from "react";
import { ALL_PROVIDERS_LIST, type ProviderName } from "@/lib/provider-features";

// Per-provider supported language codes (ISO-639-1), keyed by provider name.
type LanguageSupport = Partial<Record<ProviderName, string[]>>;

// Shape of /compare/api/language-support: the union the selector offers, and
// each provider's own list.
type LanguageSupportResponse = {
  all_languages: string[];
  providers: LanguageSupport;
};

const displayNames = new Intl.DisplayNames(["en"], { type: "language" });

export type SupportedLanguage = { code: string; name: string };

interface UseLanguageSupportResult {
  /** Returns the providers that support a given language code. */
  getProvidersForLanguage: (languageCode: string) => ProviderName[];
  /** Every language at least one provider supports. */
  languages: SupportedLanguage[];
  isLoading: boolean;
}

export const useLanguageSupport = (): UseLanguageSupportResult => {
  const [support, setSupport] = useState<LanguageSupport>({});
  const [codes, setCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    load("/compare/api/language-support")
      .then((data: LanguageSupportResponse) => {
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
      ALL_PROVIDERS_LIST.filter(
        // Every STT provider has a language table, so a provider missing from
        // the map supports nothing. (The translate app differs on purpose:
        // there Gemini and OpenAI auto-detect and have no table, so a missing
        // entry means unconstrained.)
        (provider) => supportSets[provider]?.has(languageCode) ?? false
      ),
    [supportSets]
  );

  const languages = useMemo(
    () =>
      codes.map((code) => {
        // Intl knows every code in the table; fall back to the code itself
        // rather than rendering "undefined" if it ever doesn't.
        let name = code;
        try {
          name = displayNames.of(code) ?? code;
        } catch {
          name = code;
        }
        return { code, name };
      }),
    [codes]
  );

  return { getProvidersForLanguage, languages, isLoading };
};
