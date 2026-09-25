import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConfig } from "@/contexts/config-context";
import { useTts } from "@/contexts/tts-context";
import { getLanguageName } from "@/lib/languages";
import {
  PROVIDERS,
  PROVIDER_DISPLAY_NAMES,
  groupOf,
  getProviderIcon,
  type ProviderName,
} from "@/lib/providers";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

const PINNED_CODES = ["en"];

export const LanguageSelect = ({ className }: { className?: string }) => {
  const { languages, isLanguageSupported } = useConfig();
  const { language, setLanguage, isPlayingAll } = useTts();
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const sorted = languages
      .map((code) => ({ code, name: getLanguageName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const pinned = PINNED_CODES.map((code) =>
      sorted.find((option) => option.code === code),
    ).filter((option): option is (typeof sorted)[number] => Boolean(option));

    const rest = sorted.filter((option) => !PINNED_CODES.includes(option.code));

    return [...pinned, ...rest];
  }, [languages]);

  const displayLabel = getLanguageName(language);

  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={isPlayingAll}
      className={cn(
        "justify-between gap-2 bg-white dark:bg-zinc-800 sm:min-w-[180px]",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <CodeBadge code={language} />
        <span className="hidden truncate text-left sm:inline">
          {displayLabel}
        </span>
      </span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/10 backdrop-blur-[2px]"
        className="flex max-h-[min(82vh,680px)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle className="text-sm font-semibold">Language</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col">
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
              <CommandGroup className="[&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-col [&_[cmdk-group-items]]:gap-1">
                {options.map(({ code, name }) => {
                  const isSelected = code === language;
                  const providers = PROVIDERS.filter((provider) =>
                    isLanguageSupported(code, provider),
                  );

                  return (
                    <CommandItem
                      key={code}
                      value={code}
                      keywords={[name, code]}
                      onSelect={() => {
                        setLanguage(code);
                        setOpen(false);
                      }}
                      className={cn(
                        "group flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2",
                        isSelected &&
                          "bg-soniox/10 data-[selected=true]:bg-soniox/15",
                      )}
                    >
                      <CodeBadge code={code} selected={isSelected} />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm leading-tight text-zinc-800 dark:text-zinc-100",
                          isSelected && "font-semibold text-soniox",
                        )}
                      >
                        {name}
                      </span>
                      {providers.length > 0 && (
                        <ProviderLogos providers={providers} />
                      )}
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 text-soniox transition-opacity",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const CodeBadge = ({
  code,
  selected,
}: {
  code: string;
  selected?: boolean;
}) => (
  <span
    className={cn(
      "grid h-6 w-6 shrink-0 place-items-center rounded-full",
      selected
        ? "bg-soniox/15 text-soniox"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300",
    )}
  >
    <span className="block font-mono text-[9px] font-semibold uppercase leading-none tracking-normal">
      {code}
    </span>
  </span>
);

const MAX_VISIBLE_LOGOS = 6;

const ProviderLogos = ({ providers }: { providers: ProviderName[] }) => {
  const visible = providers.slice(0, MAX_VISIBLE_LOGOS);
  const overflow = providers.length - visible.length;

  return (
    <span className="flex shrink-0 items-center gap-1 opacity-35 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100">
      {visible.map((provider) => (
        <span
          key={provider}
          title={PROVIDER_DISPLAY_NAMES[groupOf(provider)]}
          className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white p-[3px]"
        >
          <img
            src={getProviderIcon(provider)}
            alt={PROVIDER_DISPLAY_NAMES[groupOf(provider)]}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[9px] font-semibold text-zinc-400">
          +{overflow}
        </span>
      )}
    </span>
  );
};
