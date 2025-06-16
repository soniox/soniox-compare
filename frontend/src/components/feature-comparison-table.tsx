import React from "react";

import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Asterisk,
  ExternalLink,
  type LucideIcon,
  HelpCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SONIOX_PROVIDER, type ProviderName } from "@/lib/provider-features";
import type { FeatureInfo, ProviderFeatures } from "@/app";
import { cn, snakeCaseToTitle } from "@/lib/utils";

const IGNORED_FEATURES = ["confidence_scores", "timestamps"];

const FEATURE_DOCS_MAP: Record<string, string> = {
  single_multilingual_model:
    "https://soniox.com/docs/speech-to-text/core-concepts/supported-languages",
  language_hints:
    "https://soniox.com/docs/speech-to-text/core-concepts/language-hints",
  language_identification:
    "https://soniox.com/docs/speech-to-text/core-concepts/language-identification",
  speaker_diarization:
    "https://soniox.com/docs/speech-to-text/core-concepts/speaker-diarization",
  customization:
    "https://soniox.com/docs/speech-to-text/core-concepts/customization",
  timestamps: "https://soniox.com/docs/speech-to-text/core-concepts/timestamps",
  confidence_scores:
    "https://soniox.com/docs/speech-to-text/core-concepts/confidence-scores",
  translation_one_way:
    "https://soniox.com/docs/speech-to-text/core-concepts/real-time-translation#one-way-translation",
  translation_two_way:
    "https://soniox.com/docs/speech-to-text/core-concepts/real-time-translation#two-way-translation",
  real_time_latency_config:
    "https://soniox.com/docs/speech-to-text/core-concepts/real-time-latency",
  endpoint_detection:
    "https://soniox.com/docs/speech-to-text/core-concepts/endpoint-detection",
  manual_finalization:
    "https://soniox.com/docs/speech-to-text/core-concepts/manual-finalization",
};

interface FeatureComparisonTableProps {
  providerFeatures: ProviderFeatures;
}

export const FeatureComparisonTable: React.FC<FeatureComparisonTableProps> = ({
  providerFeatures,
}) => {
  if (!providerFeatures || Object.keys(providerFeatures).length === 0) {
    return <p>No provider features available to compare.</p>;
  }

  // Determine the order of providers, perhaps placing SONIOX_PROVIDER first
  const allProviderNames = Object.keys(providerFeatures) as ProviderName[];
  const orderedProviderNames = [
    SONIOX_PROVIDER,
    ...allProviderNames.filter((p) => p !== SONIOX_PROVIDER),
  ];

  // Use Soniox features as the baseline for rows, or a union of all features if necessary
  const allSonioxFeatures = providerFeatures[SONIOX_PROVIDER] || {};
  const filteredSonioxFeatures = Object.fromEntries(
    Object.entries(allSonioxFeatures).filter(
      ([key]) => !IGNORED_FEATURES.includes(key)
    )
  );
  if (!filteredSonioxFeatures) {
    return <p>Soniox provider features are not available.</p>;
  }

  const featureSet = Object.keys(filteredSonioxFeatures).filter(
    (key) => key !== "name" && key !== "model"
  );

  if (featureSet.length === 0) {
    return <p>No features available to compare.</p>;
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b bg-gray-100 dark:bg-gray-800">
            <th className="p-3 text-left font-semibold text-gray-700 dark:text-gray-300 sticky left-0 bg-gray-100 dark:bg-gray-800 z-10 w-[200px] min-w-[200px]">
              Feature
            </th>
            {orderedProviderNames.map((providerName) => (
              <th
                key={providerName}
                className="py-3 px-0.5 align-top text-center font-semibold text-gray-700 dark:text-gray-300 capitalize max-w-[100px]"
              >
                {providerFeatures[providerName]?.name ||
                  snakeCaseToTitle(providerName)}
                <div className="text-[10px] text-gray-400 lowercase">
                  {providerFeatures[providerName]?.model}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {featureSet.map((featureKey) => (
            <tr
              key={featureKey}
              className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="p-3 text-gray-700 dark:text-gray-300 whitespace-nowrap sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 z-10 w-[200px] min-w-[200px]">
                <div className="flex items-center">
                  <a
                    href={
                      FEATURE_DOCS_MAP[featureKey] || "https://soniox.com/docs"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gap-x-2 flex items-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {FEATURE_DOCS_MAP[featureKey] && (
                      <ExternalLink className="w-3 h-3" />
                    )}
                    <span>{snakeCaseToTitle(featureKey)}</span>
                  </a>
                </div>
              </td>
              {orderedProviderNames.map((providerName) => (
                <td key={providerName} className="py-3 text-center">
                  {renderFeatureSupport(
                    providerFeatures[providerName]?.[featureKey]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderFeatureSupport = (
  feature:
    | boolean
    | { state: "SUPPORTED" | "UNSUPPORTED" | "PARTIAL"; comment?: string }
    | undefined
) => {
  let colorClass: string = "text-red-600";
  let IconElement: LucideIcon = XCircle;
  let commentForTooltip: string | undefined = undefined;

  if (feature === true) {
    colorClass = "text-green-600";
    IconElement = CheckCircle2;
  } else if (feature === false) {
    colorClass = "text-red-600";
    IconElement = XCircle;
  } else if (feature && typeof feature === "object" && "state" in feature) {
    commentForTooltip = feature.comment;
    switch (feature.state) {
      case "SUPPORTED":
        colorClass = "text-green-600";
        IconElement = CheckCircle2;
        break;
      case "UNSUPPORTED":
        colorClass = "text-red-600";
        IconElement = XCircle;
        break;
      case "PARTIAL":
        colorClass = "text-orange-400";
        IconElement = AlertCircle;
        break;
      default:
        colorClass = "text-black";
        IconElement = HelpCircle;
        break;
    }
  }

  if (commentForTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("relative", colorClass)}>
              <IconElement className="inline-block h-5 w-5" />
              <Asterisk className="absolute -top-2 -right-2 h-3 w-3 rounded-full z-10" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-xs">
            <p>{commentForTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <IconElement className={cn("inline-block h-5 w-5", colorClass)} />;
};

export const getProviderFeaturesTextTable = ({
  providerName,
  providerFeatures,
}: {
  providerName: ProviderName;
  providerFeatures: ProviderFeatures;
}) => {
  const filteredProviderFeatures = Object.fromEntries(
    Object.entries(providerFeatures?.[providerName] || {}).filter(
      ([key]) => !IGNORED_FEATURES.includes(key)
    )
  );

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
};
