import React from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SortableProviderCard } from "@/components/sortable-provider-card";
import { useTts } from "@/contexts/tts-context";
import type { ProviderName } from "@/lib/providers";
import { cn } from "@/lib/utils";

export const ProviderGrid = () => {
  const { selectedProviders, setSelectedProviders, isPlayingAll } = useTts();
  const prefersReducedMotion = useReducedMotion();
  const canRemove = selectedProviders.length > 1;

  const handleRemoveProvider = (provider: ProviderName) => {
    setSelectedProviders(selectedProviders.filter((p) => p !== provider));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedProviders.indexOf(active.id as ProviderName);
    const newIndex = selectedProviders.indexOf(over.id as ProviderName);
    if (oldIndex === -1 || newIndex === -1) return;
    setSelectedProviders(arrayMove(selectedProviders, oldIndex, newIndex));
  };

  // Measure the cards area so we can pick a balanced column count instead of
  // greedily packing (which leaves an awkward, much-wider last row e.g. 3 + 1).
  // A callback ref attaches the observer whenever the node mounts, measuring
  // immediately.
  const [cardsWidth, setCardsWidth] = React.useState(0);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const setCardsRef = React.useCallback((node: HTMLDivElement | null) => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    if (!node) return;
    const measure = () => setCardsWidth(node.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    resizeObserverRef.current = ro;
  }, []);

  const MIN_CARD_WIDTH = 280;
  const CARD_GAP = 12; // matches gap-3
  const CARD_PADDING = 12; // matches p-3 (per side)
  const totalCards = Math.max(1, selectedProviders.length);
  // cardsWidth is the border-box; the cards lay out within the padded content.
  const availableWidth = Math.max(0, cardsWidth - 2 * CARD_PADDING);
  const maxColumns = Math.max(
    1,
    Math.floor((availableWidth + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP)),
  );
  // Even out the rows: minimise row count, then spread cards across them.
  const cappedColumns = Math.min(totalCards, maxColumns);
  const rowCount = Math.max(1, Math.ceil(totalCards / cappedColumns));
  const columnCount = Math.ceil(totalCards / rowCount);
  const cardBasis = `calc((100% - ${
    (columnCount - 1) * CARD_GAP
  }px) / ${columnCount})`;
  const cardStyle: React.CSSProperties = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: cardBasis,
    minWidth: 0,
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragging(false)}
    >
      <div className="flex h-full overflow-hidden bg-gray-100 dark:bg-gray-900">
        <div
          ref={setCardsRef}
          className={cn(
            // Flex-wrap (rather than grid) so the last row's card(s) stretch to
            // fill the remaining width instead of leaving empty column tracks.
            "flex flex-1 flex-wrap content-stretch items-stretch",
            // Padding lives inside the scroll container so it scrolls with the
            // cards instead of being a static frame around the scroll area.
            "min-w-0 gap-3 overflow-y-auto p-3",
          )}
        >
          <SortableContext
            items={selectedProviders}
            strategy={rectSortingStrategy}
          >
            {/* popLayout pulls an exiting card out of the flex flow immediately
                so the surviving cards spring into the freed space concurrently
                with the fade, instead of snapping after the exit completes. */}
            <AnimatePresence initial={false} mode="popLayout">
              {selectedProviders.map((provider) => (
                <SortableProviderCard
                  key={provider}
                  provider={provider}
                  onRemove={() => handleRemoveProvider(provider)}
                  canRemove={canRemove}
                  disabled={isPlayingAll}
                  dragActive={isDragging}
                  cardStyle={cardStyle}
                  prefersReducedMotion={!!prefersReducedMotion}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </div>
      </div>
    </DndContext>
  );
};
