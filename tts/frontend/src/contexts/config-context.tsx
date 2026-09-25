import React, { createContext, useContext, useEffect, useState } from "react";
import type { ProviderName } from "@/lib/providers";

interface Config {
  languages: string[];
  provider_languages: Record<ProviderName, string[]>;
  auto_detect_providers: ProviderName[];
}

interface ConfigContextType {
  languages: string[];
  isLanguageSupported: (language: string, provider: ProviderName) => boolean;
  infersLanguage: (provider: ProviderName) => boolean;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch("/compare/api/config")
      .then((response) => {
        if (!response.ok)
          throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then(setConfig)
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <p>Error loading config: {error.message}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <img src="/soniox.svg" alt="Soniox Logo" className="w-20" />
      </div>
    );
  }

  return (
    <ConfigContext.Provider
      value={{
        languages: config.languages,
        isLanguageSupported: (language, provider) =>
          config.provider_languages[provider].includes(language),
        infersLanguage: (provider) =>
          config.auto_detect_providers.includes(provider),
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
