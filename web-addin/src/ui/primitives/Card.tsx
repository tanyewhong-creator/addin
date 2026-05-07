import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-addin-bg border border-addin-line",
        "p-4 font-mono",
        className,
      )}
      {...rest}
    />
  ),
);
Card.displayName = "Card";
