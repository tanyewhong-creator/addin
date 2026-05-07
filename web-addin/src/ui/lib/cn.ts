import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose class names with Tailwind utility-conflict resolution.
 *
 * Pattern from shadcn/ui: clsx flattens + filters falsy, twMerge resolves
 * conflicts between Tailwind utilities (later wins).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
