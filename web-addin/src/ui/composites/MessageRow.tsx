import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

export type MessageRowProps = HTMLAttributes<HTMLDivElement> & {
  actor: "you" | "addin" | string;
  timestamp: string;     // pre-formatted, e.g. "14:02"
  children: ReactNode;   // message body
};

/**
 * Chat row: small actor + timestamp meta line, then the message body.
 * Spec §7 — used in the Chat page (Phase 1c).
 */
export const MessageRow = forwardRef<HTMLDivElement, MessageRowProps>(
  ({ actor, timestamp, children, className, ...rest }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 py-2 font-mono", className)} {...rest}>
      <div className="text-xs text-addin-fg-faint">
        {timestamp} · {actor}
      </div>
      <div className="text-sm text-addin-fg">{children}</div>
    </div>
  ),
);
MessageRow.displayName = "MessageRow";
