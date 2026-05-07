import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { TopBar, type TopBarProps } from "./TopBar";

export type PageShellProps = HTMLAttributes<HTMLDivElement> & {
  topBar?: TopBarProps;   // inline-configurable top bar
  children: ReactNode;
};

/**
 * Full-page wrapper: TopBar + main content area. Takes the full viewport
 * height. Used by every dashboard page.
 */
export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(
  ({ topBar, children, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn("min-h-screen flex flex-col bg-addin-bg text-addin-fg font-mono", className)}
      {...rest}
    >
      {topBar && <TopBar {...topBar} />}
      <main className="flex-1">{children}</main>
    </div>
  ),
);
PageShell.displayName = "PageShell";
