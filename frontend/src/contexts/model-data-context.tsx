import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { FALLBACK_MODEL_DATA } from "@/lib/fallback-model-data";
import { modelInfoSchema, type ModelInfo } from "@/lib/translation-utils";

interface ModelDataContextType {
  modelInfo: ModelInfo | null;
  isLoading: boolean;
  error: Error | null;
}

const ModelDataContext = createContext<ModelDataContextType | undefined>(
  undefined
);

export const ModelDataProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchModelData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/compare/api/soniox-model");

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(
              "Model data API endpoint not found (404), using fallback data."
            );
            // Consider validating FALLBACK_MODEL_DATA as well if it's not guaranteed to be correct
            setModelInfo(FALLBACK_MODEL_DATA);
          } else {
            throw new Error(
              `Failed to fetch model data: ${response.status} ${response.statusText}`
            );
          }
        } else {
          const rawData = await response.json();
          const validationResult = modelInfoSchema.safeParse(rawData);

          if (validationResult.success) {
            setModelInfo(validationResult.data);
          } else {
            console.error(
              "Failed to validate model data from API, using fallback:",
              validationResult.error.flatten()
            );
            setError(
              new Error("Received invalid model data format from server.")
            );
            // Consider validating FALLBACK_MODEL_DATA as well
            setModelInfo(FALLBACK_MODEL_DATA);
          }
        }
      } catch (e) {
        console.error("Error fetching model data, using fallback:", e);
        setError(
          e instanceof Error
            ? e
            : new Error("An unknown error occurred while fetching model data")
        );
        // Consider validating FALLBACK_MODEL_DATA as well
        setModelInfo(FALLBACK_MODEL_DATA as ModelInfo); // Use fallback on any error
      } finally {
        setIsLoading(false);
      }
    };

    fetchModelData();
  }, []);

  return (
    <ModelDataContext.Provider value={{ modelInfo, isLoading, error }}>
      {children}
    </ModelDataContext.Provider>
  );
};

export const useModelData = (): ModelDataContextType => {
  const context = useContext(ModelDataContext);
  if (context === undefined) {
    throw new Error("useModelData must be used within a ModelDataProvider");
  }
  return context;
};
