import { useId, type ReactNode, Children, cloneElement, isValidElement } from "react";
import { cn } from "../lib/cn";

export type FieldProps = {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({ label, help, error, required, children }: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const child = Children.only(children);
  const enhanced = isValidElement(child)
    ? cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": [helpId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })
    : child;

  return (
    <div className={cn("flex flex-col gap-1")}>
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-wider text-addin-fg-muted font-mono"
      >
        {label}
        {required && <span className="text-addin-danger ml-1">*</span>}
      </label>
      {enhanced}
      {error && (
        <p id={errorId} className="text-xs text-addin-danger font-mono">
          {error}
        </p>
      )}
      {help && !error && (
        <p id={helpId} className="text-xs text-addin-fg-faint font-mono">
          {help}
        </p>
      )}
    </div>
  );
}
