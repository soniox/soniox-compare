import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { ALL_PROVIDERS_LIST, type ProviderName } from "@/lib/provider-features";
import { snakeCaseToTitle } from "@/lib/utils";

import type { Mode } from "@/hooks/use-url-settings";

const IGNORED_FEATURES = [
  "confidence_scores",
  "timestamps",
  "max_language_hints",
];

/** The `SupportedFeatures` field that gates selectability in each mode. */
const MODE_FEATURE_KEY: Record<Mode, string> = {
  text: "text_translation",
  s2s: "speech_to_speech",
};

const featureInfoSchema = z.object({
  state: z.enum(["SUPPORTED", "UNSUPPORTED", "PARTIAL"]),
  comment: z.string().optional(),
});

const providerFeaturesSchema = z.record(
  z.enum(ALL_PROVIDERS_LIST),
  z
    .object({
      name: z.string(),
      model: z.string(),
      max_language_hints: z.number().nullable().optional(),
    })
    .catchall(z.union([z.boolean(), featureInfoSchema])),
);

export type FeatureInfo = z.infer<typeof featureInfoSchema>;
export type ProviderFeatures = z.infer<typeof providerFeaturesSchema>;

export type FeatureState = FeatureInfo["state"];

export interface FeatureListItem {
  key: string;
  label: string;
  state: FeatureState;
  comment?: string;
}

interface FeatureContextType {
  providerFeatures: ProviderFeatures | null;
  availableProviders: ProviderName[];
  isLoading: boolean;
  error: Error | null;
  getProviderFeatures: (
    providerName: ProviderName,
  ) => Record<string, FeatureInfo | boolean | string>;
  getProviderFeaturesList: (providerName: ProviderName) => FeatureListItem[];
  /** Whether a provider offers a feature at all; PARTIAL counts as yes. */
  supportsFeature: (providerName: ProviderName, featureKey: string) => boolean;
  /**
   * Whether a provider can run in the given mode, and why not if it can't.
   * Drives the greyed-out tiles in the provider picker.
   */
  getModeSupport: (
    providerName: ProviderName,
    mode: Mode,
  ) => { supported: boolean; reason?: string };
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

type Props = {
  children: ReactNode;
};

export const FeatureProvider = ({ children }: Props) => {
  const [providerFeatures, setProviderFeatures] =
    useState<ProviderFeatures | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Only providers the backend actually registered. Keeps the picker honest
  // when a provider is dropped or added without a frontend change.
  const availableProviders = useMemo(() => {
    if (!providerFeatures) return [];
    return ALL_PROVIDERS_LIST.filter((p) => providerFeatures[p] !== undefined);
  }, [providerFeatures]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/compare/api/providers-features`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        try {
          const validatedData = providerFeaturesSchema.parse(data);
          setProviderFeatures(validatedData);
        } catch (err) {
          console.error(
            "[FeatureContext] Error parsing provider features:",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (err as any).errors || err,
          );
          setError(
            err instanceof Error
              ? err
              : new Error("Error parsing provider features"),
          );
        }
      })
      .catch((fetchErr) => {
        console.error(
          "[FeatureContext] Error fetching provider features:",
          fetchErr,
        );
        setError(fetchErr);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const getProviderFeatures = useCallback(
    (providerName: ProviderName) => {
      const entries = Object.entries(
        providerFeatures?.[providerName] || {},
      ).filter(
        ([key, value]) =>
          ![...IGNORED_FEATURES, "name", "model"].includes(key) &&
          typeof value !== "number" &&
          value !== null,
      ) as [string, FeatureInfo | boolean | string][];
      return Object.fromEntries(entries);
    },
    [providerFeatures],
  );

  const getProviderFeaturesList = useCallback(
    (providerName: ProviderName): FeatureListItem[] => {
      const filteredProviderFeatures = getProviderFeatures(providerName);

      return Object.entries(filteredProviderFeatures)
        .map(([key, value]): FeatureListItem | null => {
          if (typeof value === "string") {
            return null;
          }
          if (typeof value === "boolean") {
            return {
              key,
              label: snakeCaseToTitle(key),
              state: value ? "SUPPORTED" : "UNSUPPORTED",
            };
          }
          return {
            key,
            label: snakeCaseToTitle(key),
            state: value.state,
            comment: value.comment,
          };
        })
        .filter((item): item is FeatureListItem => item !== null);
    },
    [getProviderFeatures],
  );

  const supportsFeature = useCallback(
    (providerName: ProviderName, featureKey: string) => {
      const value = providerFeatures?.[providerName]?.[featureKey];
      if (typeof value === "boolean") return value;
      if (value && typeof value === "object") {
        return value.state === "SUPPORTED" || value.state === "PARTIAL";
      }
      return false;
    },
    [providerFeatures],
  );

  const getModeSupport = useCallback(
    (providerName: ProviderName, mode: Mode) => {
      const feature = providerFeatures?.[providerName]?.[MODE_FEATURE_KEY[mode]];
      // Unknown provider, or a backend that predates the field: assume it works
      // rather than silently disabling a tile the user can't diagnose.
      if (!feature || typeof feature !== "object") return { supported: true };
      return {
        supported: feature.state !== "UNSUPPORTED",
        reason: feature.comment || undefined,
      };
    },
    [providerFeatures],
  );

  return (
    <FeatureContext.Provider
      value={{
        providerFeatures,
        availableProviders,
        isLoading,
        error,
        getProviderFeatures,
        getProviderFeaturesList,
        supportsFeature,
        getModeSupport,
      }}
    >
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = (): FeatureContextType => {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error("useFeatures must be used within a FeatureProvider");
  }
  return context;
};
