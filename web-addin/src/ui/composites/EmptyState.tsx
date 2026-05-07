import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  message: string;
  action?: ReactNode;   // optional button / link
};

/**
 * Single-line empty state. Per spec §6.4, no illustration — just words.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ message, action, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-3 py-12 font-mono text-sm text-addin-fg-muted", className)}
      {...rest}
    >
      <span>{message}</span>
      {action}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
