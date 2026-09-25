import type { CSSProperties, Ref } from "react";
import { X } from "lucide-react";
import { motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ProviderPanel } from "@/components/provider-panel";
import {
  groupOf,
  PROVIDER_DISPLAY_NAMES,
  type ProviderName,
} from "@/lib/providers";
import { cn } from "@/lib/utils";

type Props = {
  provider: ProviderName;
  onRemove: () => void;
  canRemove: boolean;
  disabled: boolean;
  dragActive: boolean;
  cardStyle: CSSProperties;
  prefersReducedMotion: boolean;
  ref?: Ref<HTMLDivElement>;
};

export const SortableProviderCard = ({
  provider,
  onRemove,
  canRemove,
  disabled,
  dragActive,
  cardStyle,
  prefersReducedMotion,
  ref,
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

  const title = PROVIDER_DISPLAY_NAMES[groupOf(provider)];

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
      className="group relative min-h-0 sm:min-h-40"
    >
      <div
        ref={setNodeRef}
        style={dragStyle}
        className={cn("h-full w-full rounded-xl", isDragging && "shadow-xl")}
      >
        <ProviderPanel
          provider={provider}
          disableCostTooltip={dragActive}
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
        />
      </div>
    </motion.div>
  );
};
