import React, { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, Info, Languages } from "lucide-react";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { useModelData } from "@/contexts/model-data-context";
import {
  getAvailableSourceLanguagesForModel,
  getAvailableTargetLanguagesForModel,
  getLanguageNameByCode,
  getPartnerLanguagesForTwoWay,
  getUniqueLanguagesFromTwoWayPairs,
  type Language,
} from "@/lib/translation-utils";
import { SearchSelect } from "@/components/ui/search-select";

export const TranslationSettings: React.FC = () => {
  const {
    settings,
    setTargetTranslationLanguage,
    setSourceTranslationLanguages,
    setTranslationType,
    setTranslationLanguageA,
    setTranslationLanguageB,
  } = useUrlSettings();
  const {
    translationType,
    targetTranslationLanguage,
    sourceTranslationLanguages,
    translationLanguageA,
    translationLanguageB,
  } = settings;

  const { recordingState } = useComparison();
  const isRecording = recordingState === "recording";
  const isStarting = recordingState === "starting";

  const {
    modelInfo,
    isLoading: isModelLoading,
    error: modelError,
  } = useModelData();

  const [availableTargets, setAvailableTargets] = useState<Language[]>([]);
  const [availableSources, setAvailableSources] = useState<Language[]>([]);
  const [twoWayAllLangs, setTwoWayAllLangs] = useState<Language[]>([]);
  const [twoWayPartnersForA, setTwoWayPartnersForA] = useState<Language[]>([]);

  useEffect(() => {
    if (modelInfo) {
      const targets = getAvailableTargetLanguagesForModel(modelInfo);
      setAvailableTargets(targets);
      const allTwoWay = getUniqueLanguagesFromTwoWayPairs(modelInfo);
      setTwoWayAllLangs(allTwoWay);
    } else {
      setAvailableTargets([]);
      setTwoWayAllLangs([]);
    }
  }, [modelInfo]);

  // Effect for one-way translation source languages logic
  useEffect(() => {
    if (
      modelInfo &&
      targetTranslationLanguage &&
      translationType === "one_way"
    ) {
      const sources = getAvailableSourceLanguagesForModel(
        modelInfo,
        targetTranslationLanguage,
        translationType
      );
      setAvailableSources(sources);
    } else {
      setAvailableSources([]);
    }
  }, [modelInfo, targetTranslationLanguage, translationType]);

  // Effect for two-way translation language A and B logic
  useEffect(() => {
    if (modelInfo && translationType === "two_way") {
      if (translationLanguageA) {
        const partners = getPartnerLanguagesForTwoWay(
          modelInfo,
          translationLanguageA
        );
        setTwoWayPartnersForA(partners);
        if (
          !translationLanguageB ||
          !partners.find((p) => p.code === translationLanguageB)
        ) {
          setTranslationLanguageB(partners.length > 0 ? partners[0].code : "");
        }
      } else {
        setTwoWayPartnersForA([]);
        setTranslationLanguageB(""); // Clear B if A is not set
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelInfo, translationType, translationLanguageA]);

  if (isModelLoading) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 px-1">
        Loading translation model data...
      </p>
    );
  }

  if (!modelInfo) {
    return (
      <div className="mt-4 p-2 border border-red-300 dark:border-red-700 rounded-md bg-red-50 dark:bg-red-900/30">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            Critical Error: Translation features unavailable.
          </p>
        </div>
        <p className="text-xs text-red-600 dark:text-red-400 mt-1 pl-7">
          Could not load required model data.
        </p>
      </div>
    );
  }

  let currentSourceValue = "*";
  if (sourceTranslationLanguages && sourceTranslationLanguages.length === 1) {
    currentSourceValue = sourceTranslationLanguages[0];
  }

  const controlsDisabled = isRecording || isStarting || !modelInfo;

  return (
    <>
      {modelError && (
        <div className="mt-4 p-2 border border-yellow-300 dark:border-yellow-700 rounded-md bg-yellow-50 dark:bg-yellow-900/30">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              API for model data failed. Using fallback translation settings.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center space-x-2 mb-1">
          <Label
            htmlFor="translation-type-toggle"
            className="text-sm font-medium text-gray-700 dark:text-gray-300 block"
          >
            Translation type
          </Label>
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 cursor-help opacity-50" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p>
                  <strong>One-way:</strong> Translate from one or more source
                  languages into a single target language.
                </p>
                <p className="mt-1">
                  <strong>Two-way:</strong> Translate bi-directionally between
                  two specific languages. Ideal for conversational use cases.
                  All spoken audio in either of the two specified languages is
                  translated into the other.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ToggleGroup
          id="translation-type-toggle"
          type="single"
          value={translationType}
          onValueChange={setTranslationType}
          className="w-full grid grid-cols-2 border border-input rounded-md"
          disabled={controlsDisabled}
        >
          <ToggleGroupItem
            value="one_way"
            aria-label="One-way translation"
            className="data-[state=on]:bg-soniox data-[state=on]:text-white text-gray-700 dark:text-gray-300 hover:bg-soniox/10 dark:hover:bg-soniox/20 data-[state=on]:hover:bg-soniox/90"
          >
            <Languages className="h-4 w-4 mr-2 opacity-70" />
            One-way
          </ToggleGroupItem>
          <ToggleGroupItem
            value="two_way"
            aria-label="Two-way translation"
            className="data-[state=on]:bg-soniox data-[state=on]:text-white text-gray-700 dark:text-gray-300 hover:bg-soniox/10 dark:hover:bg-soniox/20 data-[state=on]:hover:bg-soniox/90"
          >
            <Languages className="h-4 w-4 mr-2 opacity-70" />
            Two-way
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {translationType === "one_way" && (
        <div>
          <div className="mt-4">
            <Label
              htmlFor="target-lang-search-select"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
            >
              Target language
            </Label>
            <SearchSelect
              value={targetTranslationLanguage}
              onValueChange={(value: string) => {
                setTargetTranslationLanguage(value);
                setSourceTranslationLanguages([]); // Reset source when target changes in one-way
              }}
              disabled={controlsDisabled}
              options={availableTargets.map((lang) => ({
                value: lang.code,
                label: lang.name,
              }))}
              placeholder={`Select target language`}
              searchPlaceholder="Search target language..."
              notFoundMessage="No target language found."
              className="w-full text-sm bg-white dark:bg-zinc-800"
            />
          </div>

          <div className="mt-4">
            <Label
              htmlFor="source-lang-search-select"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
            >
              Source language
            </Label>
            <SearchSelect
              value={currentSourceValue}
              onValueChange={(value: string) => {
                if (value === "*") {
                  setSourceTranslationLanguages(["*"]);
                } else {
                  setSourceTranslationLanguages([value]);
                }
              }}
              disabled={controlsDisabled || !targetTranslationLanguage}
              options={[
                ...(translationType === "one_way" &&
                targetTranslationLanguage === "en"
                  ? [
                      {
                        value: "*",
                        label: getLanguageNameByCode(modelInfo, "*"),
                      },
                    ]
                  : []),
                ...availableSources.map((lang) => ({
                  value: lang.code,
                  label: lang.name,
                })),
              ]}
              placeholder={`Select source language`}
              searchPlaceholder="Search source language..."
              notFoundMessage="No source language found."
              className="w-full text-sm bg-white dark:bg-zinc-800"
            />
          </div>
        </div>
      )}
      {translationType === "two_way" && (
        <div>
          <div className="mt-4">
            <Label
              htmlFor="language-a-search-select"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
            >
              Language A
            </Label>
            <SearchSelect
              value={translationLanguageA}
              onValueChange={(value: string) => {
                setTranslationLanguageA(value);
              }}
              disabled={controlsDisabled || twoWayAllLangs.length === 0}
              options={twoWayAllLangs.map((lang) => ({
                value: lang.code,
                label: lang.name,
              }))}
              placeholder="Select Language A"
              searchPlaceholder="Search Language A..."
              notFoundMessage="No languages available for two-way translation."
              className="w-full text-sm bg-white dark:bg-zinc-800"
            />
          </div>
          <div className="mt-4">
            <Label
              htmlFor="language-b-search-select"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1"
            >
              Language B
            </Label>
            <SearchSelect
              value={translationLanguageB}
              onValueChange={(value: string) => {
                setTranslationLanguageB(value);
              }}
              disabled={
                controlsDisabled ||
                !translationLanguageA ||
                twoWayPartnersForA.length === 0
              }
              options={twoWayPartnersForA.map((lang) => ({
                value: lang.code,
                label: lang.name,
              }))}
              placeholder={
                !translationLanguageA
                  ? "Select Language A first"
                  : "Select Language B"
              }
              searchPlaceholder="Search Language B..."
              notFoundMessage="No compatible languages found for Language A."
              className="w-full text-sm bg-white dark:bg-zinc-800"
            />
          </div>
        </div>
      )}
    </>
  );
};
