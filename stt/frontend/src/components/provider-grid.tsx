import React from "react";
import { useLanguageSupport } from "@/hooks/use-language-support";
import { useUrlSettings } from "@/hooks/use-url-settings";
import { useComparison } from "@/contexts/comparison-context";
import { SONIOX_PROVIDER, type ProviderName } from "@/lib/provider-features";
import { cn } from "@/lib/utils";
import { useFeatures } from "@/contexts/feature-context";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ProviderFeaturesTooltip } from "./provider-features-tooltip";
import { InfoMessages } from "./info-messages";
import { AddProviderTile } from "./add-provider-tile";
import { MobileComparisonCard } from "./mobile-comparison-card";
import { ModelSelect } from "@/components/model-select";
import { ProviderOptions } from "@/components/provider-options";
import { SortableProviderCard } from "./sortable-provider-card";
import { TranscriptRenderer } from "./transcript-renderer";
import { RawMessageRenderer } from "./raw-message-renderer";
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

const MOBILE_CARD_LIMIT = 2;

export const ProviderGrid = () => {
  const { settings, setSelectedProviders } = useUrlSettings();
  const { getProvidersForLanguage } = useLanguageSupport();
  const { selectedProviders = [], rawMode } = settings;

  const { providerOutputs, rawOutputs, appError, recordingState } =
    useComparison();
  const { providerFeatures, availableProviders, getProviderFeaturesList } =
    useFeatures();

  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const isBusy =
    recordingState === "recording" ||
    recordingState === "starting" ||
    recordingState === "connecting" ||
    recordingState === "stopping";

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
  // greedily packing (which leaves an awkward, much-wider last row e.g. 6 + 2).
  // A callback ref attaches the observer whenever the node mounts (the desktop
  // branch isn't present on the very first render), measuring immediately.
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
    // Keep cards usable when many rows / short viewports would otherwise squash
    // them; the container scrolls once the rows no longer fit.
    minHeight: "10rem",
  };

  const nameOf = (provider: ProviderName) =>
    providerFeatures?.[provider]?.name ?? provider;

  const accentOf = (provider: ProviderName) =>
    provider === SONIOX_PROVIDER ? "text-soniox" : undefined;

  // A provider that cannot do the selected language says so in its own message
  // area, next to the warnings the backend sends, rather than only failing once
  // recording starts.
  const languageWarning = (providerName: ProviderName) => {
    const hint = (settings.languageHints ?? [])[0];
    if (!hint || getProvidersForLanguage(hint).includes(providerName)) {
      return [];
    }
    return [
      {
        message: `This provider does not support ${hint}. Pick another language, or another model for it.`,
        level: "warning" as const,
      },
    ];
  };

  const renderPanelBody = (providerName: ProviderName) => {
    const outputData = providerOutputs[providerName] || {
      statusMessage: "Waiting for data...",
      finalParts: [],
      nonFinalParts: [],
      error: "",
      infoMessages: [],
    };
    return (
      <div className="absolute flex flex-col inset-0">
        <div className="relative flex-1">
          {rawMode ? (
            <RawMessageRenderer
              messages={rawOutputs[providerName] || []}
              statusMessage={outputData.statusMessage}
              appError={appError}
            />
          ) : (
            <TranscriptRenderer outputData={outputData} appError={appError} />
          )}
        </div>
        <InfoMessages
          infoMessages={[
            ...languageWarning(providerName),
            ...outputData.infoMessages,
            ...(outputData.error
              ? [{ message: outputData.error, level: "error" as const }]
              : []),
          ]}
        />
      </div>
    );
  };

  if (isMobile) {
    const shown = selectedProviders.slice(0, MOBILE_CARD_LIMIT);
    const pickableProviders = availableProviders.filter(
      (p) => !shown.includes(p),
    );

    const handleSwapProvider = (index: number) => (provider: ProviderName) => {
      const next = [...shown];
      next[index] = provider;
      setSelectedProviders(next);
    };

    return (
      <div className="flex h-full flex-col gap-3 overflow-hidden bg-gray-100 p-3 dark:bg-gray-900">
        {shown.map((provider, index) => (
          // Keyed by slot, not provider: a swap has to keep the card mounted
          // for it to flip back rather than pop in.
          <div key={index} className="min-h-0 flex-1">
            <MobileComparisonCard
              provider={provider}
              title={nameOf(provider)}
              subtitle={
                <div className="flex min-w-0 items-center gap-1.5">
                  <ModelSelect
                    provider={provider}
                    providerFeatures={providerFeatures}
                    disabled={isBusy}
                  />
                  <ProviderOptions
                    provider={provider}
                    providerFeatures={providerFeatures}
                    disabled={isBusy}
                  />
                </div>
              }
              titleTooltip={
                <ProviderFeaturesTooltip
                  features={getProviderFeaturesList(provider)}
                />
              }
              pickableProviders={pickableProviders}
              providerFeatures={providerFeatures}
              onSwap={handleSwapProvider(index)}
              disabled={isBusy}
              prefersReducedMotion={!!prefersReducedMotion}
              className={accentOf(provider)}
            >
              {renderPanelBody(provider)}
            </MobileComparisonCard>
          </div>
        ))}

        {shown.length < MOBILE_CARD_LIMIT && (
          <div className="min-h-0 flex-1">
            <AddProviderTile
              remainingProviders={pickableProviders}
              providerFeatures={providerFeatures}
              onAdd={(provider) => setSelectedProviders([...shown, provider])}
              disabled={isBusy}
              prefersReducedMotion={!!prefersReducedMotion}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragging(false)}
    >
      <div className="flex bg-gray-100 dark:bg-gray-900 h-full overflow-hidden">
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
              {selectedProviders.map((providerName) => (
                <SortableProviderCard
                  key={providerName}
                  provider={providerName}
                  title={nameOf(providerName)}
                  subtitle={
                    <div className="flex min-w-0 items-center gap-1.5">
                      <ModelSelect
                        provider={providerName}
                        providerFeatures={providerFeatures}
                        disabled={isBusy}
                      />
                      <ProviderOptions
                        provider={providerName}
                        providerFeatures={providerFeatures}
                        disabled={isBusy}
                      />
                    </div>
                  }
                  titleTooltip={
                    <ProviderFeaturesTooltip
                      features={getProviderFeaturesList(providerName)}
                    />
                  }
                  onRemove={() => handleRemoveProvider(providerName)}
                  canRemove={canRemove}
                  disabled={isBusy}
                  disableTitleTooltip={isDragging}
                  className={accentOf(providerName)}
                  dragActive={isDragging}
                  cardStyle={cardStyle}
                  prefersReducedMotion={!!prefersReducedMotion}
                >
                  {renderPanelBody(providerName)}
                </SortableProviderCard>
              ))}
            </AnimatePresence>
          </SortableContext>
        </div>
      </div>
    </DndContext>
  );
};
