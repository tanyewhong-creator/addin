import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

export type TopBarProps = HTMLAttributes<HTMLElement> & {
  brand?: ReactNode;     // wordmark
  nav?: ReactNode;       // top-level nav items
  end?: ReactNode;       // right-side controls (⌘K, status)
};

/**
 * Dashboard top-bar chrome. 44px tall; hairline bottom border; mono throughout.
 * Spec §7.1.
 */
export const TopBar = forwardRef<HTMLElement, TopBarProps>(
  ({ brand, nav, end, className, ...rest }, ref) => (
    <header
      ref={ref}
      className={cn(
        "flex items-center h-11 px-4 bg-addin-bg",
        "border-b border-addin-line",
        "font-mono text-sm",
        className,
      )}
      {...rest}
    >
      <div className="flex-shrink-0 mr-6">{brand}</div>
      <nav className="flex-1 flex gap-0">{nav}</nav>
      {end && <div className="flex-shrink-0 flex items-center gap-3 text-xs text-addin-fg-muted">{end}</div>}
    </header>
  ),
);
TopBar.displayName = "TopBar";
