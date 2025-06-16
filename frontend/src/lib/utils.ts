import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const snakeCaseToTitle = (key: string) => {
  const spacedString = key.replace(/_/g, " ");
  return spacedString.charAt(0).toUpperCase() + spacedString.slice(1);
};
