import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  /** Max width preset. Default "lg" (1024px). */
  size?: "sm" | "md" | "lg" | "xl";
};

const sizeMap = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
} as const;

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ size = "lg", className, ...rest }, ref) => (
    <div ref={ref} className={cn("mx-auto px-4", sizeMap[size], className)} {...rest} />
  ),
);
Container.displayName = "Container";
