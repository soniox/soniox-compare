import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import {
  ALL_PROVIDERS_LIST,
  SONIOX_PROVIDER,
  type ProviderName,
} from "@/lib/provider-features";
import { OPERATION_MODES } from "@/lib/comparison-constants";
import { ActionPanel } from "./action-panel";
import { TranslationSettings } from "./translation-settings";
import { useModelData } from "@/contexts/model-data-context";
import { SearchSelect } from "@/components/ui/search-select";
import { FaDiscord, FaGithub } from "react-icons/fa";

export const ControlPanel: React.FC = () => {
  const { providerFeatures, recordingState } = useComparison();

  const { modelInfo } = useModelData();

  const {
    settings,
    setSelectedProviders,
    setMode,
    setLanguageHints,
    // setContext,
    setEnableSpeakerDiarization,
    setEnableLanguageIdentification,
    setEnableEndpointDetection,
  } = useUrlSettings();
  const {
    selectedProviders = [],
    mode,
    languageHints = [],
    // context = "",
    enableSpeakerDiarization,
    enableLanguageIdentification,
    enableEndpointDetection,
  } = settings;

  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";

  const availableComparisonProviders = providerFeatures
    ? ALL_PROVIDERS_LIST.filter((p) => p !== SONIOX_PROVIDER)
    : [];

  const handleProviderSelectionChange = (
    provider: ProviderName,
    checked: boolean | "indeterminate"
  ) => {
    const isActuallyChecked = checked === true;
    const newSelectedProviders = isActuallyChecked
      ? [...selectedProviders, provider]
      : selectedProviders.filter((p) => p !== provider);
    setSelectedProviders(newSelectedProviders);
  };

  const handleLanguageHintChange = (value: string) => {
    if (value === "AUTO") {
      setLanguageHints([]);
    } else {
      setLanguageHints([value]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className="relative flex-1">
        <div className="flex absolute z-10 top-0 inset-x-0 right-4 justify-between items-center p-4">
          <div className="absolute inset-x-0 top-0 flex flex-col pointer-events-none w-full">
            <div className="bg-zinc-50 h-12 -z-10" />
            <div className="h-8 bg-gradient-to-b from-zinc-50 to-transparent -z-10" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-100">
            Soniox Compare
          </h2>
          <TooltipProvider>
            <div className="flex -mr-4 text-gray-400 items-center gap-x-1">
              {/* A github button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://discord.com/invite/rWfnk9uM5j"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon" className="">
                      <FaDiscord className="size-5" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Join Discord</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/soniox/soniox-compare"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon">
                      <FaGithub className="size-5" />
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View on GitHub</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="absolute inset-0 overflow-y-auto flex flex-col space-y-6 p-4 pt-12">
          <div className="w-full space-y-4 pt-6">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              Providers
            </Label>
            <div className="space-y-2 max-h-60 overflow-y-auto p-2 border rounded-md dark:border-gray-700 bg-white dark:bg-zinc-800">
              {availableComparisonProviders.map((provider) => (
                <div key={provider} className="flex items-center space-x-2">
                  <Checkbox
                    id={`provider-checkbox-${provider}`}
                    checked={selectedProviders.includes(provider)}
                    onCheckedChange={(checkedState) =>
                      handleProviderSelectionChange(provider, checkedState)
                    }
                    disabled={isRecording || !providerFeatures}
                    className="data-[state=checked]:bg-soniox data-[state=checked]:text-white"
                  />
                  <Label
                    htmlFor={`provider-checkbox-${provider}`}
                    className="text-sm font-normal capitalize cursor-pointer"
                  >
                    {providerFeatures?.[provider]?.name ?? provider}
                    <span className="text-xs text-gray-400 dark:text-gray-500 lowercase">
                      {providerFeatures?.[provider]?.model}
                    </span>
                  </Label>
                </div>
              ))}
              {availableComparisonProviders.length === 0 &&
                providerFeatures && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 p-2">
                    No other providers available for comparison.
                  </p>
                )}
              {!providerFeatures && (
                <p className="text-xs text-gray-400 dark:text-gray-500 p-2">
                  Loading provider list...
                </p>
              )}
            </div>
          </div>

          <div className="w-full space-y-4 dark:border-gray-700">
            <div>
              <Label
                htmlFor="op-mode"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
              >
                Operation mode
              </Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "stt" | "mt")}
                disabled={isRecording}
              >
                <SelectTrigger
                  id="op-mode"
                  className="w-full text-sm bg-white dark:bg-zinc-800"
                >
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  {OPERATION_MODES.map((opMode) => (
                    <SelectItem
                      key={opMode.value}
                      value={opMode.value}
                      className="text-sm"
                    >
                      {opMode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === "stt" && (
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Label
                    htmlFor="input-lang"
                    className="text-sm font-medium text-gray-700 dark:text-gray-300 block"
                  >
                    Input language
                  </Label>
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 cursor-help opacity-50" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Most providers require an input language. Soniox can
                          auto-detect spoken language in real-time. Try it out
                          by selecting Multilingual option and start talking in
                          different languages.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <SearchSelect
                  value={languageHints.length > 0 ? languageHints[0] : "AUTO"}
                  onValueChange={handleLanguageHintChange}
                  disabled={isRecording}
                  options={[
                    { value: "AUTO", label: "Multilingual (auto-detect)" },
                    ...(modelInfo?.languages.map((lang) => ({
                      value: lang.code,
                      label: lang.name,
                    })) || []),
                  ]}
                  placeholder="Select input language hint"
                  searchPlaceholder="Search languages..."
                  notFoundMessage="No language found."
                  className="w-full text-sm bg-white dark:bg-zinc-800"
                />
              </div>
            )}
            {mode === "mt" && <TranslationSettings />}
          </div>

          <div className="w-full space-y-4 mb-6">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              Settings
            </Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-diarization"
                  checked={enableSpeakerDiarization}
                  onCheckedChange={(checked) =>
                    setEnableSpeakerDiarization(Boolean(checked))
                  }
                  disabled={isRecording || isStarting}
                  className="data-[state=checked]:bg-soniox data-[state=checked]:text-white"
                />
                <Label
                  htmlFor="enable-diarization"
                  className="text-sm font-normal cursor-pointer"
                >
                  Enable speaker diarization
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-lang-id"
                  checked={enableLanguageIdentification}
                  onCheckedChange={(checked) =>
                    setEnableLanguageIdentification(Boolean(checked))
                  }
                  disabled={isRecording || isStarting}
                  className="data-[state=checked]:bg-soniox data-[state=checked]:text-white"
                />
                <Label
                  htmlFor="enable-lang-id"
                  className="text-sm font-normal cursor-pointer"
                >
                  Enable language identification
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enable-endpoint-detection"
                  checked={enableEndpointDetection}
                  onCheckedChange={(checked) =>
                    setEnableEndpointDetection(Boolean(checked))
                  }
                  disabled={isRecording || isStarting}
                  className="data-[state=checked]:bg-soniox data-[state=checked]:text-white"
                />
                <Label
                  htmlFor="enable-endpoint-detection"
                  className="text-sm font-normal cursor-pointer"
                >
                  Enable endpoint detection
                </Label>
              </div>
              {/* <div className="mt-4">
                <Label
                  htmlFor="context"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
                >
                  Context (Optional)
                </Label>
                <Textarea
                  id="context"
                  value={context}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setContext(e.target.value)
                  }
                  placeholder="Provide relevant context, names, or keywords to improve transcription accuracy..."
                  className="w-full text-sm bg-white dark:bg-zinc-800"
                  rows={3}
                  disabled={isRecording || isStarting}
                />
              </div> */}
            </div>
          </div>
        </div>
      </div>

      <ActionPanel />
    </div>
  );
};
