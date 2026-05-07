import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full font-mono text-sm",
        "bg-addin-bg text-addin-fg",
        "border border-addin-line",
        "px-3 py-2",
        "transition-colors duration-150",
        "placeholder:text-addin-fg-faint",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-addin-line-strong",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "resize-y",
        className,
      )}
      {...rest}
    />
  ),
);
Textarea.displayName = "Textarea";
