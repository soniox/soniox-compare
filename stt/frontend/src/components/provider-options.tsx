import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { ProviderFeatures } from "@/contexts/feature-context";
import {
  useUrlSettings,
  type ProviderOptionValue,
} from "@/hooks/use-url-settings";
import type { ProviderName } from "@/lib/provider-features";
import { cn } from "@/lib/utils";

type Props = {
  provider: ProviderName;
  providerFeatures: ProviderFeatures | null;
  disabled?: boolean;
};

/** Holds what the user typed while the field has focus, so a partial number
 * like "0." survives; only a value that parses is committed. */
const NumberOrTextInput = ({
  id,
  fallback,
  value,
  onCommit,
}: {
  id: string;
  fallback: number | string;
  value: ProviderOptionValue;
  onCommit: (value: ProviderOptionValue) => void;
}) => {
  const isNumber = typeof fallback === "number";
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    if (!isNumber) {
      onCommit(text);
      return;
    }
    const parsed = Number(text);
    if (text.trim() !== "" && !Number.isNaN(parsed)) {
      onCommit(parsed);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode={isNumber ? "decimal" : "text"}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        commit(e.target.value);
      }}
      onBlur={() => setDraft(null)}
      className="h-6 w-20 shrink-0 rounded border border-zinc-200 bg-transparent px-1.5 text-right text-[11px] dark:border-zinc-700"
    />
  );
};

/** Per-provider request parameters that have no equivalent at other providers,
 * so they belong on the card rather than in the shared settings dialog. Each
 * one is listed under the vendor's own parameter name, and starts at the value
 * this app sends when nothing is changed. Renders nothing for a provider that
 * declares no options. */
export const ProviderOptions = ({
  provider,
  providerFeatures,
  disabled,
}: Props) => {
  const { settings, setProviderOption } = useUrlSettings();
  const declared = providerFeatures?.[provider]?.options ?? {};
  const overrides = settings.providerOptions?.[provider] ?? {};
  const keys = Object.keys(declared);
  const changed = keys.filter((key) => key in overrides).length;

  if (keys.length === 0) {
    return null;
  }

  const set = (key: string, value: ProviderOptionValue) => {
    if (value === declared[key]?.default) {
      setProviderOption(provider, key, undefined);
    } else {
      setProviderOption(provider, key, value);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`${provider} options`}
        className={cn(
          "flex shrink-0 cursor-pointer items-center gap-0.5 text-[10px] leading-tight text-zinc-400 hover:text-zinc-600 disabled:cursor-default disabled:hover:text-zinc-400 dark:hover:text-zinc-200",
          changed > 0 && "text-soniox hover:text-soniox"
        )}
      >
        <SlidersHorizontal className="h-3 w-3" />
        {changed > 0 && <span>{changed}</span>}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          {providerFeatures?.[provider]?.name} options
        </p>
        {keys.map((key) => {
          const fallback = declared[key].default;
          const value = overrides[key] ?? fallback;
          return (
            <div key={key} className="rounded-md px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor={`${provider}-${key}`}
                  className="min-w-0 truncate font-mono text-[11px] text-zinc-700 dark:text-zinc-200"
                >
                  {key}
                </label>
                {typeof fallback === "boolean" ? (
                  <Switch
                    id={`${provider}-${key}`}
                    checked={Boolean(value)}
                    onCheckedChange={(checked) => set(key, checked)}
                  />
                ) : (
                  <NumberOrTextInput
                    id={`${provider}-${key}`}
                    fallback={fallback}
                    value={value}
                    onCommit={(next) => set(key, next)}
                  />
                )}
              </div>
              {declared[key].comment && (
                <p className="mt-0.5 pr-10 text-[10px] leading-snug text-zinc-400">
                  {declared[key].comment}
                </p>
              )}
            </div>
          );
        })}
        <p className="px-2 py-1 text-[10px] leading-snug text-zinc-400">
          Sent to {providerFeatures?.[provider]?.name} as named. Unset values
          use what this app sends by default.
        </p>
      </PopoverContent>
    </Popover>
  );
};
