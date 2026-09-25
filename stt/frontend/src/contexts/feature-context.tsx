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
import {
  ALL_PROVIDERS_LIST,
  SONIOX_PROVIDER,
  type ProviderName,
} from "@/lib/provider-features";
import { snakeCaseToTitle } from "@/lib/utils";

const IGNORED_FEATURES = [
  "confidence_scores",
  "timestamps",
  "max_language_hints",
  // Rendered by ProviderOptions on the card, not as a capability row.
  "options",
];

const featureInfoSchema = z.object({
  state: z.enum(["SUPPORTED", "UNSUPPORTED", "PARTIAL"]),
  comment: z.string().optional(),
});

const optionValueSchema = z.union([z.boolean(), z.number(), z.string()]);

export const providerOptionSchema = z.object({
  default: optionValueSchema,
  comment: z.string().default(""),
});

export const providerOptionsSchema = z.record(z.string(), providerOptionSchema);

export type ProviderOptionValue = z.infer<typeof optionValueSchema>;
export type ProviderOptionSpec = z.infer<typeof providerOptionSchema>;

const providerFeaturesSchema = z.record(
  z.enum(ALL_PROVIDERS_LIST),
  z
    .object({
      name: z.string(),
      model: z.string(),
      max_language_hints: z.number().nullable().optional(),
      options: providerOptionsSchema.default({}),
    })
    .catchall(z.union([z.boolean(), featureInfoSchema])),
);

export type ProviderOptionValues = z.infer<typeof providerOptionsSchema>;

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
  getFeatureSet: () => string[];
  getProviderFeaturesTextTable: (providerName: ProviderName) => string;
  getProviderFeaturesList: (providerName: ProviderName) => FeatureListItem[];
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

  const availableProviders = useMemo(() => {
    return providerFeatures ? [...ALL_PROVIDERS_LIST] : [];
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

  const getFeatureSet = useCallback(() => {
    return Object.keys(getProviderFeatures(SONIOX_PROVIDER));
  }, [getProviderFeatures]);

  const getProviderFeaturesTextTable = useCallback(
    (providerName: ProviderName) => {
      const filteredProviderFeatures = getProviderFeatures(providerName);

      const getStateIcon = (state: FeatureInfo["state"]) => {
        switch (state) {
          case "SUPPORTED":
            return "✅";
          case "UNSUPPORTED":
            return "❌";
          case "PARTIAL":
            return "⚠️";
        }
      };

      return Object.entries(filteredProviderFeatures)
        .filter(([, value]) => {
          if (typeof value === "string") {
            return false;
          }
          return true;
        })
        .map(([key, value]) => {
          if (typeof value === "boolean") {
            return `${value ? "✅" : "❌"} ${key}:`;
          }
          if (typeof value === "string") {
            return null;
          }
          return `${getStateIcon(value.state)} ${snakeCaseToTitle(key)}`;
        })
        .join("\n");
    },
    [getProviderFeatures],
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

  return (
    <FeatureContext.Provider
      value={{
        providerFeatures,
        availableProviders,
        isLoading,
        error,
        getProviderFeatures,
        getFeatureSet,
        getProviderFeaturesTextTable,
        getProviderFeaturesList,
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
