import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";
export type LabelProps = HTMLAttributes<HTMLSpanElement>;
export const Label = forwardRef<HTMLSpanElement, LabelProps>(
  ({ className, ...rest }, ref) => (
    <span ref={ref} className={cn("font-mono text-xs uppercase tracking-wider text-addin-fg-muted", className)} {...rest} />
  ),
);
Label.displayName = "Label";
