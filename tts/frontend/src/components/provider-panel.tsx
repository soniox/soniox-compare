import { FrequencyBars } from "@/components/frequency-bars";
import { ModelSelect } from "@/components/model-select";
import { ProviderCost } from "@/components/provider-cost";
import { ProviderNotice } from "@/components/provider-notice";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/contexts/config-context";
import { useTts } from "@/contexts/tts-context";
import {
  groupOf,
  PROVIDER_DISPLAY_NAMES,
  getProviderIcon,
  type ProviderName,
} from "@/lib/providers";
import { cn } from "@/lib/utils";
import { Loader2, Play, Square } from "lucide-react";
import { useCallback, type HTMLAttributes, type ReactNode } from "react";

type Props = {
  provider: ProviderName;
  headerProps?: HTMLAttributes<HTMLDivElement>;
  headerClassName?: string;
  disableCostTooltip?: boolean;
  trailingElement?: ReactNode;
};

export const ProviderPanel = ({
  provider,
  headerProps,
  headerClassName,
  disableCostTooltip = false,
  trailingElement,
}: Props) => {
  const { isLanguageSupported, infersLanguage } = useConfig();
  const {
    language,
    providerStates,
    play,
    stop,
    stopAll,
    isPlayingAll,
    getAnalyser,
  } = useTts();
  const { status, error } = providerStates[provider];
  const supported = isLanguageSupported(language, provider);
  const showLanguageNotice = supported && infersLanguage(provider);
  const isSoniox = provider === "soniox";

  const isActive =
    status === "loading" || status === "playing" || status === "paused";
  const isHidden = isPlayingAll && !isActive;

  const idleButtonClass = isSoniox
    ? "bg-soniox hover:bg-soniox/90"
    : "bg-zinc-300 hover:bg-soniox";

  const buttonClass =
    status === "playing" ? "bg-zinc-800 hover:bg-zinc-700" : idleButtonClass;

  const getProviderAnalyser = useCallback(
    () => getAnalyser(provider),
    [getAnalyser, provider],
  );

  const handleClick = () => {
    if (isPlayingAll) {
      stopAll();
      return;
    }
    if (status === "playing" || status === "loading") stop(provider);
    else play(provider);
  };

  return (
    <section className="relative w-full h-full min-h-0 flex flex-row items-center gap-2 px-2 py-1 sm:flex-col sm:items-stretch sm:gap-0 sm:p-0 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-950">
      {supported && isActive && (
        <div className="hidden sm:block pointer-events-none absolute inset-x-0 bottom-0">
          <FrequencyBars
            getAnalyser={getProviderAnalyser}
            active={status === "playing"}
            className="text-[#EEEFF4] dark:text-zinc-800"
          />
        </div>
      )}
      <div
        {...headerProps}
        className={cn(
          "relative min-w-0 sm:border-b border-zinc-200 dark:border-zinc-700 sm:p-2",
          headerClassName,
        )}
      >
        <div className="flex flex-row items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-md dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
            <img
              src={getProviderIcon(provider)}
              alt={`${PROVIDER_DISPLAY_NAMES[groupOf(provider)]} logo`}
              className="h-6 w-6 object-contain"
            />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h2
              className={cn(
                "w-fit max-w-full text-sm font-bold truncate leading-tight text-zinc-800 dark:text-zinc-100",
                isSoniox && "text-soniox dark:text-soniox",
              )}
            >
              {PROVIDER_DISPLAY_NAMES[groupOf(provider)]}
            </h2>
            <ModelSelect provider={provider} />
          </div>
          <ProviderCost
            provider={provider}
            providerName={PROVIDER_DISPLAY_NAMES[groupOf(provider)]}
            disableTooltip={disableCostTooltip}
          />
          {trailingElement && (
            <div className="hidden shrink-0 items-center sm:flex">
              {trailingElement}
            </div>
          )}
        </div>
      </div>

      {/* Mobile only */}
      <div className="min-w-0 flex-1 sm:hidden pointer-events-none">
        {supported && isActive && (
          <FrequencyBars
            getAnalyser={getProviderAnalyser}
            active={status === "playing"}
            height={40}
            className="text-[#EEEFF4] dark:text-zinc-800"
          />
        )}
      </div>

      <div className="relative shrink-0 sm:flex-grow flex flex-col items-center justify-center gap-2 sm:p-4">
        {supported ? (
          <>
            <Button
              size="icon"
              onClick={handleClick}
              tabIndex={isHidden ? -1 : undefined}
              aria-hidden={isHidden}
              className={cn(
                "h-11 w-11 sm:h-14 sm:w-14 rounded-full transition-all duration-300",
                buttonClass,
                isHidden && "scale-75 opacity-0 pointer-events-none",
              )}
            >
              {status === "loading" ? (
                <Loader2 className="size-6 animate-spin" />
              ) : status === "playing" ? (
                <Square className="size-5 fill-current" />
              ) : (
                <Play className="size-6 fill-current" />
              )}
            </Button>
            <p
              className={cn(
                "text-xs text-center leading-snug sm:min-h-4",
                status === "error" ? "text-red-500" : "text-zinc-400",
                status !== "error" && "hidden sm:block",
              )}
            >
              {status === "error"
                ? error
                : status === "loading"
                  ? "Generating..."
                  : status === "playing"
                    ? "Playing"
                    : status === "paused"
                      ? "Paused"
                      : " "}
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-400 text-center">
            Language not supported
          </p>
        )}
      </div>

      {trailingElement && (
        <div className="flex shrink-0 items-center sm:hidden">
          {trailingElement}
        </div>
      )}

      {showLanguageNotice && (
        <div className="hidden sm:block">
          <ProviderNotice
            message="Language is inferred from the text."
            detail="This provider does not support language selection; it infers the language from the text."
          />
        </div>
      )}
    </section>
  );
};
