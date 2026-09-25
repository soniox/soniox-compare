import { AlertTriangle } from "lucide-react";

type Props = {
  message: string;
  detail?: string;
};

export const ProviderNotice = ({ message, detail }: Props) => (
  <div className="relative z-10 shrink-0 border-t border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-950">
    <div
      className="flex items-center gap-2 truncate px-2 py-1.5"
      title={detail ?? message}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
      <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
        {message}
      </span>
    </div>
  </div>
);
