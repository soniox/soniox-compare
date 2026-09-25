import React from "react";
import { ChevronsUpDown, Languages } from "lucide-react";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { useFeatures } from "@/contexts/feature-context";
import { useLanguageSupport } from "@/hooks/use-language-support";
import { Button } from "@/components/ui/button";
import { CommandGroup, CommandSeparator } from "@/components/ui/command";
import { ALL_PROVIDERS_LIST, type ProviderName } from "@/lib/provider-features";
import {
  languageHintsEqual,
  sanitizeLanguageHints,
} from "@/lib/language-hints";
import { cn } from "@/lib/utils";
import { CodeBadge } from "./code-badge";
import { LanguageDialog, LanguageRow } from "./language-dialog";

const AUTO_VALUE = "AUTO";

type Props = {
  className?: string;
};

export const LanguageSelect = ({ className }: Props) => {
  const { recordingState } = useComparison();
  const { providerFeatures, supportsFeature } = useFeatures();
  const { settings, setLanguageHints } = useUrlSettings();
  const { getProvidersForLanguage, languages: sourceLanguages, isLoading: isModelLoading } =
    useLanguageSupport();

  const [open, setOpen] = React.useState(false);
  const [pinnedOrder, setPinnedOrder] = React.useState<string[]>([]);

  const languageHints = React.useMemo(
    () => settings.languageHints ?? [],
    [settings.languageHints],
  );
  const isAutoDetect = languageHints.length === 0;
  const isRecording = recordingState === "recording";

  const languages = React.useMemo(() => {
    const sorted = [...(sourceLanguages)].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (pinnedOrder.length === 0) return sorted;
    const pinnedSet = new Set(pinnedOrder);
    const pinned = pinnedOrder
      .map((code) => sorted.find((lang) => lang.code === code))
      .filter((lang): lang is (typeof sorted)[number] => Boolean(lang));
    const rest = sorted.filter((lang) => !pinnedSet.has(lang.code));
    return [...pinned, ...rest];
  }, [sourceLanguages, pinnedOrder]);

  const validCodeSet = React.useMemo(
    () => new Set((sourceLanguages).map((lang) => lang.code)),
    [sourceLanguages],
  );

  React.useEffect(() => {
    if (sourceLanguages.length === 0) return;
    const sanitized = sanitizeLanguageHints(languageHints, validCodeSet);
    if (!languageHintsEqual(sanitized, languageHints)) {
      setLanguageHints(sanitized);
    }
  }, [sourceLanguages, languageHints, validCodeSet, setLanguageHints]);

  const primaryCode = languageHints[0];
  const firstSelectedLanguage = languages.find(
    (lang) => lang.code === primaryCode,
  );
  const extraSelectedCount = Math.max(languageHints.length - 1, 0);

  const displayCode = isAutoDetect
    ? null
    : (firstSelectedLanguage?.code ?? primaryCode);
  const displayLabel = isAutoDetect
    ? "Auto-detect"
    : (firstSelectedLanguage?.name ??
      (isModelLoading ? primaryCode.toUpperCase() : "Unknown language"));

  const autoDetectProviders = React.useMemo(
    () =>
      ALL_PROVIDERS_LIST.filter((provider) =>
        supportsFeature(provider, "language_identification"),
      ),
    [supportsFeature],
  );

  const handleSelect = (code: string) => {
    if (code === AUTO_VALUE || code === "") {
      setLanguageHints([]);
      setOpen(false);
      return;
    }
    if (languageHints.includes(code)) {
      setLanguageHints(languageHints.filter((c) => c !== code));
    } else {
      const validExisting = sanitizeLanguageHints(languageHints, validCodeSet);
      setLanguageHints([...validExisting, code]);
    }
  };

  const providerName = (provider: ProviderName) =>
    providerFeatures?.[provider]?.name ?? provider;

  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={isRecording}
      className={cn(
        "justify-between gap-2 bg-white dark:bg-zinc-800 sm:min-w-[180px]",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {displayCode === null ? (
          <>
            <Languages className="hidden h-4 w-4 shrink-0 text-zinc-500 sm:block" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300 sm:hidden">
              {AUTO_VALUE}
            </span>
          </>
        ) : (
          <CodeBadge code={displayCode} />
        )}
        <span className="hidden truncate text-left sm:inline">
          {displayLabel}
        </span>
        {!isAutoDetect && extraSelectedCount > 0 && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            +{extraSelectedCount}
          </span>
        )}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <LanguageDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setPinnedOrder(languageHints);
        setOpen(nextOpen);
      }}
      trigger={triggerButton}
      title="Input language"
    >
      <CommandGroup>
        <LanguageRow
          code={AUTO_VALUE}
          name="Auto-detect language"
          keywords={["auto", "automatic", "detect"]}
          selected={isAutoDetect}
          providers={autoDetectProviders}
          getProviderName={providerName}
          onSelect={handleSelect}
          icon={
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
              <Languages className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-300" />
            </span>
          }
        />
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup className="[&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-1">
        {languages.map((lang) => (
          <LanguageRow
            key={lang.code}
            code={lang.code}
            name={lang.name}
            keywords={[lang.name, lang.code]}
            selected={languageHints.includes(lang.code)}
            providers={getProvidersForLanguage(lang.code)}
            getProviderName={providerName}
            onSelect={handleSelect}
          />
        ))}
      </CommandGroup>
    </LanguageDialog>
  );
};
