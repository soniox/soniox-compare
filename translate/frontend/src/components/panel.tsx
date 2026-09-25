import { cn } from "@/lib/utils";
import React from "react";
import { ResponsiveTooltip } from "./ui/responsive-tooltip";

export const Panel = ({
  title,
  subtitle,
  titleTooltip,
  children,
  muted = false,
  className = "",
  trailingElement,
  headerProps,
  headerClassName,
  disableTitleTooltip = false,
  logo,
  priceSection,
}: {
  title: string;
  subtitle?: string;
  titleTooltip?: React.ReactNode;
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
  trailingElement?: React.ReactNode;
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
  headerClassName?: string;
  disableTitleTooltip?: boolean;
  logo?: React.ReactNode;
  // Live cost estimate block, with its own tooltip.
  priceSection?: React.ReactNode;
}) => {
  const titleElement = titleTooltip && !disableTitleTooltip ? (
    <ResponsiveTooltip
      content={titleTooltip}
      contentClassName="bg-white text-zinc-800 border border-zinc-200 shadow-md rounded-lg px-3 py-2.5 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
      arrowClassName="bg-white fill-white border-b border-r border-zinc-200 dark:bg-zinc-900 dark:fill-zinc-900 dark:border-zinc-700"
    >
      <span className="cursor-default">{title}</span>
    </ResponsiveTooltip>
  ) : (
    title
  );

  return (
    <section
      className={cn(
        "w-full h-full min-h-0 pt-0 flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700",
        muted ? "bg-zinc-100" : "bg-white"
      )}
    >
      <div
        {...headerProps}
        className={cn(
          "sticky top-0 z-10 border-b p-2",
          muted ? "bg-zinc-100" : "bg-white",
          headerClassName
        )}
      >
        <div className="flex flex-row items-center gap-2.5">
          <div className="h-9 w-9 shrink-0 rounded-md dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
            {logo}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            {/* Swallow pointer-down on the title so its hover tooltip doesn't
                clash with starting a drag from the header. */}
            <h2
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "w-fit max-w-full text-sm font-bold capitalize truncate leading-tight",
                muted ? "text-zinc-700" : "text-zinc-800",
                className
              )}
            >
              {titleElement}
            </h2>
            {subtitle && (
              <p className="text-[10px] font-medium text-zinc-400 lowercase truncate leading-tight">
                {subtitle}
              </p>
            )}
          </div>

          {priceSection}

          {trailingElement && (
            <div className="shrink-0 flex items-center">{trailingElement}</div>
          )}
        </div>
      </div>
      <div className="flex-grow overflow-y-auto relative">{children}</div>
    </section>
  );
};
