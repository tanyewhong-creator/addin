import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";
export type CaptionProps = HTMLAttributes<HTMLSpanElement>;
export const Caption = forwardRef<HTMLSpanElement, CaptionProps>(
  ({ className, ...rest }, ref) => (
    <span ref={ref} className={cn("font-mono text-xs text-addin-fg-faint", className)} {...rest} />
  ),
);
Caption.displayName = "Caption";
