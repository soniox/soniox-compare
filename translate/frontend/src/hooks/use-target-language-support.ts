import { useEffect, useMemo, useState } from "react";
import { ALL_PROVIDERS_LIST, type ProviderName } from "@/lib/provider-features";

// `providers` maps each provider to the *target*-language codes it can
// translate into; `all_languages` is the union across providers, computed
// server-side.
type TargetLanguageSupport = {
  all_languages: string[];
  providers: Partial<Record<ProviderName, string[]>>;
};

export interface Language {
  code: string;
  name: string;
}

interface UseTargetLanguageSupportResult {
  /** Every target language any provider can translate into, name-sorted. */
  languages: Language[];
  /** Providers that can translate into a given target language. */
  getProvidersForLanguage: (languageCode: string) => ProviderName[];
  isLoading: boolean;
}

const languageName = (code: string): string => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
};

export const useTargetLanguageSupport = (): UseTargetLanguageSupportResult => {
  const [support, setSupport] = useState<TargetLanguageSupport["providers"]>(
    {}
  );
  const [codes, setCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/compare/api/target-language-support")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: TargetLanguageSupport) => {
        if (cancelled) return;
        setSupport(data.providers);
        setCodes(data.all_languages);
      })
      .catch((err) => {
        console.warn(
          "[useTargetLanguageSupport] failed to load support data:",
          err
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const supportSets = useMemo(() => {
    const sets = {} as Partial<Record<ProviderName, Set<string>>>;
    for (const [provider, codes] of Object.entries(support)) {
      sets[provider as ProviderName] = new Set(codes);
    }
    return sets;
  }, [support]);

  // Per-provider gaps show up as a shorter "supported by" logo row on the
  // language row itself.
  const languages = useMemo(
    () =>
      codes
        .map((code) => ({ code, name: languageName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [codes]
  );

  const getProvidersForLanguage = useMemo(
    () => (languageCode: string) =>
      // A provider with no target list can translate into nothing (unlike the
      // source hook, where a missing list means unconstrained).
      ALL_PROVIDERS_LIST.filter(
        (provider) => supportSets[provider]?.has(languageCode) ?? false
      ),
    [supportSets]
  );

  return { languages, getProvidersForLanguage, isLoading };
};
