import type { OutputData, TranscriptPart } from "@/contexts/comparison-context";
import { cn } from "@/lib/utils";
import React, { memo } from "react";
import { AutoScrollContainer } from "./ui/autoscroll";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Markdown from "react-markdown";

export const SPEAKER_COLORS = [
  "#007ecc", // Blue
  "#5aa155", // Green
  "#e0585b", // Red
  "#f18f3b", // Orange
  "#77b7b2", // Teal
  "#edc958", // Yellow
  "#af7aa0", // Purple
  "#fe9ea8", // Pink
  "#9c7561", // Brown
  "#bab0ac", // Gray
  "#8884d8", // Light Purple
  "#82ca9d", // Light Green
  "#ff7f0e", // Vivid Orange
  "#1f77b4", // Ocean Blue
  "#d62728", // Crimson
  "#9467bd", // Lavender
  "#8c564b", // Reddish Brown
  "#e377c2", // Magenta
  "#7f7f7f", // Neutral Gray
  "#bcbd22", // Lime
  "#17becf", // Cyan
  "#aec7e8", // Light Blue
  "#c5b0d5", // Soft Purple
  "#ffbb78", // Soft Orange
  "#98df8a", // Soft Green
];

interface TranscriptRendererProps {
  outputData: OutputData;
  appError?: string | null;
}

const TranscriptRenderer: React.FC<TranscriptRendererProps> = ({
  outputData,
  appError,
}) => {
  const { statusMessage, finalParts, nonFinalParts, error } = outputData;

  const renderParts = (
    parts: TranscriptPart[],
    isFinalStyling: boolean,
    previousPartSpeaker?: number | string | null,
    previousPartLanguage?: string | null,
    previousPartTranslationStatus?: string | null,
    keyPrefix?: string
  ) => {
    const elementsArray: React.ReactNode[] = [];

    parts.forEach((part, index) => {
      const partSpeaker = part.speaker || null;
      const partLanguage = part.language || null;
      const partTranslationStatus = part.translation_status || null;

      let displaySpeakerName = false;
      let displayLanguageTag = false;

      if (partSpeaker && partSpeaker !== previousPartSpeaker) {
        displaySpeakerName = true;
      }

      // This logic remains to track *when* a language tag should be shown
      if (partLanguage) {
        if (displaySpeakerName) {
          displayLanguageTag = true;
        } else if (partLanguage !== previousPartLanguage) {
          displayLanguageTag = true;
        }
      }

      let headerWasDrawnThisIteration = false;
      if (displaySpeakerName) {
        const headerDivColor =
          SPEAKER_COLORS[(Number(partSpeaker) - 1) % SPEAKER_COLORS.length];

        elementsArray.push(
          <div
            key={`${keyPrefix}-header-${index}`}
            className="mt-3 text-base"
            style={{ color: headerDivColor }}
          >
            <span key="spk-name" className="font-semibold uppercase text-sm">
              SPEAKER {partSpeaker}
            </span>
          </div>
        );
        headerWasDrawnThisIteration = true;
      }

      const textToRender = headerWasDrawnThisIteration
        ? part.text.trimStart()
        : part.text;

      elementsArray.push(
        <WordToken
          key={`${keyPrefix}-part-${index}`}
          part={part}
          isFinalStyling={isFinalStyling}
          textToRender={textToRender}
          displayedLanguage={
            partLanguage !== previousPartLanguage && displayLanguageTag
              ? partLanguage
              : null
          }
          onNewLine={
            partLanguage !== previousPartLanguage &&
            !displaySpeakerName &&
            Boolean(previousPartLanguage)
          }
          addSpacing={
            partTranslationStatus !== previousPartTranslationStatus &&
            previousPartTranslationStatus === "translation" &&
            !displaySpeakerName
          }
        />
      );

      previousPartSpeaker = partSpeaker;
      previousPartLanguage = partLanguage;
      previousPartTranslationStatus = partTranslationStatus;
    });

    return {
      elements: elementsArray,
      newLastSpeaker: previousPartSpeaker,
      newLastLanguage: previousPartLanguage,
      newLastTranslationStatus: previousPartTranslationStatus,
    };
  };

  let content = null;

  if (appError) {
    content = <ErrorMessage error={appError} />;
  } else if (error) {
    content = <ErrorMessage error={error} />;
  } else if (statusMessage) {
    content = <p className="text-gray-500 italic">{statusMessage}</p>;
  } else if (finalParts.length === 0 && nonFinalParts.length === 0) {
    content = <p className="text-gray-400 italic">No output yet...</p>;
  } else {
    const finalRender = renderParts(
      finalParts,
      true,
      undefined,
      undefined,
      undefined,
      "final"
    );
    let combinedElements: React.ReactNode[] = [...finalRender.elements];

    if (nonFinalParts.length > 0) {
      const nonFinalRender = renderParts(
        nonFinalParts,
        false,
        finalRender.newLastSpeaker,
        finalRender.newLastLanguage,
        finalRender.newLastTranslationStatus,
        "nonfinal"
      );
      combinedElements = [...combinedElements, ...nonFinalRender.elements];
    }
    content = <>{combinedElements}</>;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AutoScrollContainer className="absolute inset-0 pb-20">
        {content}
      </AutoScrollContainer>
    </TooltipProvider>
  );
};

const ErrorMessage = ({ error }: { error: string }) => {
  return (
    <div className="text-soniox bg-blue-50 p-4 absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 text-center text-sm rounded-2xl">
      <div className="brightness-90">
        <Markdown
          components={{
            a: ({ ...props }) => (
              <a
                className="text-soniox underline underline-offset-1"
                {...props}
                target="_blank"
                rel="noreferrer"
              />
            ),
          }}
        >
          {error}
        </Markdown>
      </div>
    </div>
  );
};

export default TranscriptRenderer;

const formatTime = (milliseconds: number): string => {
  if (typeof milliseconds !== "number" || isNaN(milliseconds)) return "";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  const remainingMs = Math.floor(milliseconds % 1000);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}.${remainingMs.toString().padStart(3, "0")}`;
};

interface WordTokenProps {
  part: TranscriptPart;
  isFinalStyling: boolean;
  textToRender: string;
  displayedLanguage: string | null;
  onNewLine: boolean;
  addSpacing: boolean;
}

const WordToken = memo(
  ({
    part,
    isFinalStyling,
    textToRender,
    displayedLanguage,
    onNewLine,
    addSpacing,
  }: WordTokenProps) => {
    // --- 1. Special rendering for <end> tag ---
    if (part.text.trim() === "<end>") {
      const endTooltipParts: string[] = [];
      if (part.start_ms !== undefined && part.start_ms !== null) {
        endTooltipParts.push(
          `Endpoint detected at: ${formatTime(part.start_ms)}`
        );
      }

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "px-2 py-1 text-gray-700 rounded-lg text-[10px] font-semibold tracking-wider",
                isFinalStyling ? "opacity-50" : "opacity-60"
              )}
            >
              {`<end>`}
            </span>
          </TooltipTrigger>
          {endTooltipParts.length > 0 && (
            <TooltipContent>
              {endTooltipParts.map((info, idx) => (
                <p key={idx}>{info}</p>
              ))}
            </TooltipContent>
          )}
        </Tooltip>
      );
    }

    // --- 2. Regular rendering for words ---
    const titleParts: string[] = [];
    if (part.start_ms !== undefined && part.start_ms !== null)
      titleParts.push(`Start: ${formatTime(part.start_ms)}`);
    if (part.end_ms !== undefined && part.end_ms !== null)
      titleParts.push(`End: ${formatTime(part.end_ms)}`);
    if (part.confidence !== undefined && part.confidence !== null)
      titleParts.push(`Confidence: ${part.confidence.toFixed(2)}`);

    const textClassName = isFinalStyling
      ? "text-gray-800 dark:text-gray-200"
      : "text-gray-500 dark:text-gray-400 italic";

    const languageTag = displayedLanguage ? (
      <>
        {onNewLine && <br />}
        {addSpacing && <div className="h-3" />}
        <span className="px-2 mr-0.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 rounded-full text-xs font-medium">
          {new Intl.DisplayNames(["en"], { type: "language" }).of(
            displayedLanguage
          ) || displayedLanguage}
        </span>
      </>
    ) : null;

    return (
      <>
        {languageTag}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                textClassName,
                part.translation_status === "translation" &&
                  "text-gray-400 dark:text-gray-500 text-sm italic",
                "hover:text-soniox rounded-lg"
              )}
            >
              {textToRender}
            </span>
          </TooltipTrigger>
          {titleParts.length > 0 && (
            <TooltipContent>
              {titleParts.map((info, idx) => (
                <p key={idx}>{info}</p>
              ))}
            </TooltipContent>
          )}
        </Tooltip>
      </>
    );
  }
);

WordToken.displayName = "WordToken";
