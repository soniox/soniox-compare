import React from "react";
import { Panel } from "@/components/panel";
import TranscriptRenderer from "@/components/transcript-renderer";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { SONIOX_PROVIDER, type ProviderName } from "@/lib/provider-features";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getProviderFeaturesTextTable } from "./feature-comparison-table";
import { cn } from "@/lib/utils";

export const ProviderGrid: React.FC = () => {
  const { settings } = useUrlSettings();
  const { selectedProviders = [] } = settings;

  const { providerOutputs, appError, providerFeatures } = useComparison();

  // Combine Soniox with other selected providers for rendering
  // Ensure Soniox is always first and no duplicates if it somehow gets into selectedProviders
  const providersToDisplay: ProviderName[] = [
    SONIOX_PROVIDER,
    ...selectedProviders.filter((p) => p !== SONIOX_PROVIDER),
  ];

  const getGridColsClass = (count: number): string => {
    if (count <= 0) return "grid-cols-1"; // Should not happen if Soniox is always there
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count === 3) return "grid-cols-3";
    if (count === 4) return "grid-cols-2"; // 2x2 grid
    // For 5 or more, use 3 columns and let it wrap. Could add xl:grid-cols-4 for very wide screens if desired.
    return "grid-cols-3";
  };

  const numProviders = providersToDisplay.length;
  const gridColsClass = getGridColsClass(numProviders);

  return (
    <div
      className={cn(
        "grid gap-px bg-gray-200 dark:bg-gray-700 h-full overflow-y-auto",
        gridColsClass
      )}
    >
      {providersToDisplay.map((providerName) => {
        const outputData = providerOutputs[providerName] || {
          statusMessage: "Waiting for data...",
          finalParts: [],
          nonFinalParts: [],
          error: null,
        };
        const panelTitle =
          providerFeatures?.[providerName]?.name ?? providerName;

        return (
          <Panel
            key={providerName}
            title={panelTitle}
            subtitle={providerFeatures?.[providerName]?.model}
            titleTooltip={getProviderFeaturesTextTable({
              providerName,
              providerFeatures,
            })}
            className={providerName === SONIOX_PROVIDER ? "text-soniox" : ""}
          >
            <TooltipProvider delayDuration={300}>
              <TranscriptRenderer outputData={outputData} appError={appError} />
            </TooltipProvider>
          </Panel>
        );
      })}
    </div>
  );
};
