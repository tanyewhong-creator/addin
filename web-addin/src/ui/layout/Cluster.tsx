import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type ClusterProps = HTMLAttributes<HTMLDivElement> & {
  gap?: 1 | 2 | 3 | 4 | 6 | 8;
  /** justify-content. Default "start". */
  justify?: "start" | "center" | "end" | "between";
  /** align-items. Default "center". */
  align?: "start" | "center" | "end" | "baseline";
};

const gapMap = { 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4", 6: "gap-6", 8: "gap-8" } as const;
const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;
const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  baseline: "items-baseline",
} as const;

export const Cluster = forwardRef<HTMLDivElement, ClusterProps>(
  ({ gap = 2, justify = "start", align = "center", className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-row flex-wrap",
        gapMap[gap], justifyMap[justify], alignMap[align],
        className,
      )}
      {...rest}
    />
  ),
);
Cluster.displayName = "Cluster";
