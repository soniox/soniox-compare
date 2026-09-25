import React from "react";
import { Check, ChevronsUpDown, Languages } from "lucide-react";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { useFeatures } from "@/contexts/feature-context";
import { useLanguageSupport } from "@/hooks/use-language-support";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ALL_PROVIDERS_LIST, type ProviderName } from "@/lib/provider-features";
import {
  languageHintsEqual,
  sanitizeLanguageHints,
} from "@/lib/language-hints";
import { cn } from "@/lib/utils";
import { CodeBadge } from "./code-badge";
import { ProviderLogos } from "./provider-logos";

const AUTO_VALUE = "AUTO";

type Props = {
  className?: string;
};

export const LanguageSelect = ({ className }: Props) => {
  const { recordingState } = useComparison();
  const { providerFeatures } = useFeatures();
  const { settings, setLanguageHints } = useUrlSettings();
  const {
    getProvidersForLanguage,
    languages: supportedLanguages,
    isLoading: isModelLoading,
  } = useLanguageSupport();

  const [open, setOpen] = React.useState(false);
  // Snapshot of the selected codes captured when the dialog opens. Used only to
  // order the list (selected on top) and kept stable while the dialog is open so
  // toggling a language doesn't make rows jump around mid-interaction.
  const [pinnedOrder, setPinnedOrder] = React.useState<string[]>([]);

  const languageHints = React.useMemo(
    () => settings.languageHints ?? [],
    [settings.languageHints]
  );
  const isAutoDetect = languageHints.length === 0;
  const isRecording = recordingState === "recording";

  const languages = React.useMemo(() => {
    const sorted = [...supportedLanguages].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    if (pinnedOrder.length === 0) return sorted;
    // Pin the selected languages to the top of the list (in selection order) so
    // they are always visible instead of buried in their alphabetical positions.
    const pinnedSet = new Set(pinnedOrder);
    const pinned = pinnedOrder
      .map((code) => sorted.find((lang) => lang.code === code))
      .filter((lang): lang is (typeof sorted)[number] => Boolean(lang));
    const rest = sorted.filter((lang) => !pinnedSet.has(lang.code));
    return [...pinned, ...rest];
  }, [supportedLanguages, pinnedOrder]);

  const validCodeSet = React.useMemo(
    () => new Set(supportedLanguages.map((lang) => lang.code)),
    [supportedLanguages]
  );

  // Once the model list is available, drop any hints that aren't real codes so a
  // corrupt URL (e.g. "?languageHints=en/") can't leave the UI in a bad state.
  React.useEffect(() => {
    if (supportedLanguages.length === 0) return;
    const sanitized = sanitizeLanguageHints(languageHints, validCodeSet);
    if (!languageHintsEqual(sanitized, languageHints)) {
      setLanguageHints(sanitized);
    }
  }, [supportedLanguages, languageHints, validCodeSet, setLanguageHints]);

  const primaryCode = languageHints[0];
  const firstSelectedLanguage = languages.find(
    (lang) => lang.code === primaryCode
  );
  const extraSelectedCount = Math.max(languageHints.length - 1, 0);

  // Code shown in the trigger badge. Falls back to the raw hint while the model
  // list is still loading so a valid "en" doesn't momentarily render as Auto.
  const displayCode = isAutoDetect
    ? null
    : firstSelectedLanguage?.code ?? primaryCode;
  const displayLabel = isAutoDetect
    ? "Auto-detect"
    : firstSelectedLanguage?.name ??
      (isModelLoading ? primaryCode.toUpperCase() : "Unknown language");

  // Providers whose `language_identification` feature is available, so the
  // Auto-detect row can show who actually supports it (not all providers do).
  const autoDetectProviders = React.useMemo(() => {
    if (!providerFeatures) return [];
    return ALL_PROVIDERS_LIST.filter((provider) => {
      const feature = providerFeatures[provider]?.language_identification;
      if (feature === undefined) return false;
      const state =
        typeof feature === "object"
          ? feature.state
          : feature
            ? "SUPPORTED"
            : "UNSUPPORTED";
      return state === "SUPPORTED" || state === "PARTIAL";
    });
  }, [providerFeatures]);

  const handleSelect = (code: string) => {
    if (code === AUTO_VALUE || code === "") {
      setLanguageHints([]);
      setOpen(false);
      return;
    }
    // Toggle the language in/out of the selected set, preserving selection order.
    // The dialog stays open so multiple languages can be picked in one session.
    if (languageHints.includes(code)) {
      setLanguageHints(languageHints.filter((c) => c !== code));
    } else {
      // Drop any corrupt/invalid existing hints before appending so a bad URL
      // value can't linger alongside a freshly picked language.
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
        className
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
        <span className="hidden truncate text-left sm:inline">{displayLabel}</span>
        {!isAutoDetect && extraSelectedCount > 0 && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            +{extraSelectedCount}
          </span>
        )}
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const renderRow = (code: string, name: string, keywords: string[]) => {
    const isAuto = code === AUTO_VALUE;
    const isSelected = isAuto ? isAutoDetect : languageHints.includes(code);
    const providers = isAuto ? autoDetectProviders : getProvidersForLanguage(code);

    return (
      <CommandItem
        key={code}
        value={code}
        keywords={keywords}
        onSelect={() => handleSelect(code)}
        className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
          isSelected &&
            "bg-soniox/10 data-[selected=true]:bg-soniox/15"
        )}
      >
        {isAuto ? (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
            <Languages className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-300" />
          </span>
        ) : (
          <CodeBadge code={code} selected={isSelected} />
        )}

        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm leading-tight text-zinc-800 dark:text-zinc-100",
            isSelected && "font-semibold text-soniox"
          )}
        >
          {name}
        </span>

        {providers.length > 0 && (
          <ProviderLogos
            providers={providers}
            getName={providerName}
            className="shrink-0"
          />
        )}

        <Check
          className={cn(
            "h-4 w-4 shrink-0 text-soniox transition-opacity",
            isSelected ? "opacity-100" : "opacity-0"
          )}
        />
      </CommandItem>
    );
  };

  const commandBody = (
    <Command
      filter={(value, search, keywords) => {
        const haystack = [value, ...(keywords ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search.toLowerCase().trim()) ? 1 : 0;
      }}
      className="bg-transparent"
    >
      <CommandInput placeholder="Search languages..." />
      <CommandList className="max-h-none min-h-0 flex-1">
        <CommandEmpty>No language found.</CommandEmpty>
        <CommandGroup>
          {renderRow(AUTO_VALUE, "Auto-detect language", [
            "auto",
            "automatic",
            "detect",
          ])}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup className="[&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-1">
          {languages.map((lang) =>
            renderRow(lang.code, lang.name, [lang.name, lang.code])
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setPinnedOrder(languageHints);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/10 backdrop-blur-[2px]"
        className="flex max-h-[min(82vh,680px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle className="text-sm font-semibold">
            Input language
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">{commandBody}</div>
      </DialogContent>
    </Dialog>
  );
};
