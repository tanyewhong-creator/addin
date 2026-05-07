import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type StackProps = HTMLAttributes<HTMLDivElement> & {
  /** Gap between children, in spacing units (1=4px, 2=8px, etc.). Default 4 (16px). */
  gap?: 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16;
};

const gapMap = {
  1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4",
  6: "gap-6", 8: "gap-8", 12: "gap-12", 16: "gap-16",
} as const;

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({ gap = 4, className, ...rest }, ref) => (
    <div ref={ref} className={cn("flex flex-col", gapMap[gap], className)} {...rest} />
  ),
);
Stack.displayName = "Stack";
