import { useEffect, type ReactNode } from "react";
import { cn } from "../lib/cn";

export type CommandBarProps = {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
};

/**
 * Minimal ⌘K palette container. Shows a centered modal-like overlay on
 * Cmd/Ctrl+K. Phase 1b ships the shell — Phase 1c wires real search.
 */
export function CommandBar({ isOpen, onClose, children }: CommandBarProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center pt-32",
        "bg-addin-fg/10 backdrop-blur-sm",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-2xl mx-4",
          "bg-addin-bg border border-addin-line-strong",
          "shadow-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children ?? (
          <div className="p-4 text-addin-fg-faint font-mono text-sm">
            command palette · phase 1c wires search
          </div>
        )}
      </div>
    </div>
  );
}
