import type React from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Panel } from "@/components/panel";
import { type ProviderName } from "@/lib/provider-features";
import { cn } from "@/lib/utils";
import { ProviderCost } from "./provider-cost";
import { ProviderLogo } from "./provider-logo";

type Props = {
  provider: ProviderName;
  title: string;
  subtitle?: React.ReactNode;
  titleTooltip?: ReactNode;
  onRemove: () => void;
  canRemove: boolean;
  disabled: boolean;
  disableTitleTooltip: boolean;
  className?: string;
  // True while any card in the grid is being dragged. Framer layout animations
  // are disabled then so they don't fight dnd-kit's transforms.
  dragActive: boolean;
  // Flex sizing (basis/grow) shared by every card so rows stay balanced.
  cardStyle: CSSProperties;
  prefersReducedMotion: boolean;
  // AnimatePresence's popLayout clones this card with a ref to measure it; it
  // silently gives up (leaving the card in flow on exit) if we don't forward it.
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
};

export const SortableProviderCard = ({
  provider,
  title,
  subtitle,
  titleTooltip,
  onRemove,
  canRemove,
  disabled,
  disableTitleTooltip,
  className,
  dragActive,
  cardStyle,
  prefersReducedMotion,
  ref,
  children,
}: Props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider, disabled });

  // Keep dnd-kit's transform off the `layout` element: framer owns transform
  // there and wins, leaving the card pinned under the cursor.
  const style: CSSProperties = {
    ...cardStyle,
    zIndex: isDragging ? 30 : undefined,
  };

  const dragStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={ref}
      style={style}
      layout={!dragActive && !prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{
        duration: 0.18,
        layout: { type: "spring", stiffness: 420, damping: 34 },
      }}
      className="group relative min-h-0"
    >
      <div
        ref={setNodeRef}
        style={dragStyle}
        className={cn("h-full w-full", isDragging && "shadow-xl")}
      >
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
                disableTooltip={disableTitleTooltip}
              />
            }
            disableTitleTooltip={disableTitleTooltip}
            headerProps={disabled ? undefined : { ...attributes, ...listeners }}
            headerClassName={cn(
              "touch-none select-none",
              !disabled && "cursor-grab active:cursor-grabbing",
            )}
            trailingElement={
              canRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  onPointerDown={(e) => e.stopPropagation()}
                  disabled={disabled}
                  aria-label={`Remove ${title}`}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : undefined
            }
          >
            {children}
          </Panel>
        </TooltipProvider>
      </div>
    </motion.div>
  );
};
