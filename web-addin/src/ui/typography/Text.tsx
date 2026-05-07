import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";
export type TextProps = HTMLAttributes<HTMLParagraphElement>;
export const Text = forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, ...rest }, ref) => (
    <p ref={ref} className={cn("font-mono text-sm text-addin-fg leading-normal", className)} {...rest} />
  ),
);
Text.displayName = "Text";
