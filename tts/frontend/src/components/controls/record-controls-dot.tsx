import { cn } from "@/lib/utils";

export const RecordControlsDot = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-block size-2.5 shrink-0 rounded-full bg-red-500 ring-2 ring-white/80",
      className,
    )}
  />
);
