import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "../lib/cn";

export type IconProps = Omit<LucideProps, "ref"> & {
  icon: LucideIcon;
  size?: 12 | 14 | 16 | 20 | 24;
};

/**
 * Wraps a lucide-react icon with a fixed 1px stroke and curated sizes.
 *
 * Always import the icon from `~/ui/icons/allowlist` to keep the icon
 * surface curated. Stroke is fixed to 1 — the spec calls for hairline
 * iconography to match the 1px border discipline.
 */
export function Icon({
  icon: IconComp,
  size = 16,
  strokeWidth = 1,
  className,
  ...rest
}: IconProps) {
  return (
    <IconComp
      size={size}
      strokeWidth={strokeWidth}
      className={cn("inline-block shrink-0", className)}
      {...rest}
    />
  );
}
