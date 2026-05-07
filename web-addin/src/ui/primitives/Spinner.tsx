import { cn } from "../lib/cn";

export type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="loading"
      className={cn(
        "inline-block font-mono text-addin-fg",
        "animate-pulse motion-reduce:animate-none",
        className,
      )}
    >
      ·
    </span>
  );
}
