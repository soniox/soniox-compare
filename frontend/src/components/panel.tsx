import { cn } from "@/lib/utils";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Panel = ({
  title,
  subtitle,
  titleTooltip,
  children,
  muted = false,
  className = "",
}: {
  title: string;
  subtitle?: string;
  titleTooltip?: string;
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
}) => {
  const titleElement = titleTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{title}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-mono">{titleTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    title
  );

  return (
    <section
      className={cn(
        "w-full pt-0 flex flex-col",
        muted ? "bg-zinc-100" : "bg-white"
      )}
    >
      <h2
        className={cn(
          "text-xl font-bold text-center capitalize px-4 sticky top-0 py-2 border-b",
          muted ? "bg-zinc-100 text-zinc-700" : "bg-white text-zinc-800",
          className
        )}
      >
        {titleElement}
        {subtitle && (
          <p className="text-[10px] text-center text-zinc-400 lowercase">
            {subtitle}
          </p>
        )}
      </h2>
      <div className="flex-grow overflow-y-auto">{children}</div>
    </section>
  );
};
