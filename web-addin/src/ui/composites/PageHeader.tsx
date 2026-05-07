import { type HTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Heading } from "../typography/Heading";

export type PageHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  subtitle?: string;
  /** Sub-tabs slot — typically a Tabs primitive instance. */
  tabs?: ReactNode;
  /** Page-level action buttons (right-aligned). */
  actions?: ReactNode;
};

/**
 * Per-page header: large mono title + optional subtitle + optional sub-tabs row + actions.
 * Used at the top of every full-page route.
 */
export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ title, subtitle, tabs, actions, className, ...rest }, ref) => (
    <div ref={ref} className={cn("border-b border-addin-line px-6 pt-6", className)} {...rest}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <Heading level={1}>{title}</Heading>
          {subtitle && <p className="text-sm text-addin-fg-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-6 -mb-px">{tabs}</div>}
    </div>
  ),
);
PageHeader.displayName = "PageHeader";
