import React, { type ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Panel } from "@/components/panel";
import type { ProviderFeatures } from "@/contexts/feature-context";
import { type ProviderName } from "@/lib/provider-features";
import { FlipCard } from "./flip-card";
import { ProviderCost } from "./provider-cost";
import { ProviderLogo } from "./provider-logo";
import { ProviderPickerBack } from "./provider-picker-back";
import { ProviderPickerGrid } from "./provider-picker-grid";

type Props = {
  provider: ProviderName;
  title: string;
  subtitle?: React.ReactNode;
  titleTooltip?: ReactNode;
  pickableProviders: ProviderName[];
  providerFeatures: ProviderFeatures | null;
  onSwap: (provider: ProviderName) => void;
  disabled: boolean;
  prefersReducedMotion: boolean;
  className?: string;
  children: ReactNode;
};

export const MobileComparisonCard = ({
  provider,
  title,
  subtitle,
  titleTooltip,
  pickableProviders,
  providerFeatures,
  onSwap,
  disabled,
  prefersReducedMotion,
  className,
  children,
}: Props) => {
  const [flipped, setFlipped] = React.useState(false);

  React.useEffect(() => {
    setFlipped(false);
  }, [provider]);

  const frontFace = (
    <TooltipProvider>
      <Panel
        title={title}
        subtitle={subtitle}
        titleTooltip={titleTooltip}
        className={className}
        logo={<ProviderLogo provider={provider} name={title} />}
        priceSection={
          <ProviderCost
            provider={provider}
            providerName={title}
            disableTooltip={flipped}
          />
        }
        disableTitleTooltip={flipped}
        trailingElement={
          <button
            type="button"
            onClick={() => setFlipped(true)}
            disabled={disabled || pickableProviders.length === 0}
            aria-label={`Switch provider (currently ${title})`}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        }
      >
        {children}
      </Panel>
    </TooltipProvider>
  );

  const backFace = (
    <ProviderPickerBack onClose={() => setFlipped(false)}>
      <ProviderPickerGrid
        providers={pickableProviders}
        providerFeatures={providerFeatures}
        onPick={(picked) => {
          onSwap(picked);
          setFlipped(false);
        }}
        prefersReducedMotion={prefersReducedMotion}
        columns={2}
      />
    </ProviderPickerBack>
  );

  return (
    <FlipCard
      flipped={flipped}
      front={frontFace}
      back={backFace}
      prefersReducedMotion={prefersReducedMotion}
    />
  );
};
