import { useEffect, type ReactNode } from "react";
import { cn } from "../lib/cn";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Modal width preset. Default md (32rem). */
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Centered modal dialog. Esc to close. Click backdrop to close.
 * Per spec §6.2 — no shadows, hairline border, mono throughout.
 */
export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "dialog"}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-addin-fg/20",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full bg-addin-bg border border-addin-line-strong",
          "font-mono",
          sizeMap[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-4 py-3 border-b border-addin-line">
            <h2 className="text-sm font-semibold text-addin-fg">{title}</h2>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
