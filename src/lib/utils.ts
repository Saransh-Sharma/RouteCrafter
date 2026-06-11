import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, resolving conflicts in favor of the last class.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
