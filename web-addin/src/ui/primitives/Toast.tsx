import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { cn } from "../lib/cn";

type ToastIntent = "default" | "success" | "danger";

type ToastEntry = {
  id: number;
  message: string;
  intent: ToastIntent;
};

type ToastApi = (message: string, opts?: { intent?: ToastIntent; durationMs?: number }) => void;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used within ToastProvider");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const push = useCallback<ToastApi>((message, opts) => {
    const id = Date.now() + Math.random();
    const entry: ToastEntry = {
      id,
      message,
      intent: opts?.intent ?? "default",
    };
    setToasts((prev) => [...prev, entry]);
    const duration = opts?.durationMs ?? 3000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "px-3 py-2 font-mono text-xs border bg-addin-bg max-w-sm",
              t.intent === "success" && "border-addin-line-strong text-addin-fg",
              t.intent === "danger" && "border-addin-danger text-addin-danger",
              t.intent === "default" && "border-addin-line text-addin-fg",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
