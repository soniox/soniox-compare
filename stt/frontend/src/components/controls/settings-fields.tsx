import React from "react";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { useFeatures } from "@/contexts/feature-context";
import { ALL_PROVIDERS_LIST, type ProviderName } from "@/lib/provider-features";
import { FeatureSection } from "./feature-section";

export const SettingsFields = () => {
  const { recordingState } = useComparison();
  const { providerFeatures } = useFeatures();
  const {
    settings,
    setEnableSpeakerDiarization,
    setEnableLanguageIdentification,
    setEnableEndpointDetection,
  } = useUrlSettings();
  const {
    enableSpeakerDiarization,
    enableLanguageIdentification,
    enableEndpointDetection,
  } = settings;

  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";
  const isBusy = isRecording || isStarting;

  const providerName = (provider: ProviderName) =>
    providerFeatures?.[provider]?.name ?? provider;

  // Providers whose feature flag is SUPPORTED (or PARTIAL) for a given key.
  // `strict` drops PARTIAL, for settings the partial providers simply ignore.
  const getProvidersForFeature = (
    featureKey: string,
    strict = false
  ): ProviderName[] =>
    ALL_PROVIDERS_LIST.filter((provider) => {
      const value = providerFeatures?.[provider]?.[featureKey];
      if (typeof value === "boolean") return value;
      if (value && typeof value === "object") {
        if (strict) return value.state === "SUPPORTED";
        return value.state === "SUPPORTED" || value.state === "PARTIAL";
      }
      return false;
    });

  // Speaker diarization and endpoint detection are mutually exclusive.
  // Guard against an invalid URL state where both arrive enabled.
  React.useEffect(() => {
    if (enableSpeakerDiarization && enableEndpointDetection) {
      setEnableEndpointDetection(false);
    }
  }, [
    enableSpeakerDiarization,
    enableEndpointDetection,
    setEnableEndpointDetection,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <FeatureSection
        title="Speaker diarization"
        description="Detects speaker changes, so multi-person conversations are easy to follow. Soniox separates and identifies speakers across 60+ languages."
        checked={enableSpeakerDiarization}
        onCheckedChange={(v) => setEnableSpeakerDiarization(v)}
        disabled={isBusy || enableEndpointDetection}
        hint={
          enableEndpointDetection
            ? "Disable endpoint detection to use speaker diarization."
            : undefined
        }
        providers={getProvidersForFeature("speaker_diarization")}
        getName={providerName}
      />

      <FeatureSection
        title="Language identification"
        description="Automatically identifies spoken languages. Soniox tags language at the token level."
        checked={enableLanguageIdentification}
        onCheckedChange={(v) => setEnableLanguageIdentification(v)}
        disabled={isBusy}
        providers={getProvidersForFeature("language_identification")}
        getName={providerName}
      />

      <FeatureSection
        title="Endpoint detection"
        description="Detects when a speaker has finished an utterance to finalize segments in real time. Soniox uses semantic endpointing for this."
        checked={enableEndpointDetection}
        onCheckedChange={(v) => setEnableEndpointDetection(v)}
        disabled={isBusy || enableSpeakerDiarization}
        hint={
          enableSpeakerDiarization
            ? "Disable speaker diarization to use endpoint detection."
            : undefined
        }
        providers={getProvidersForFeature("endpoint_detection")}
        getName={providerName}
      />
    </div>
  );
};
