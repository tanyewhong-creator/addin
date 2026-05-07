import { type HTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const headingStyles = cva("font-mono text-addin-fg tracking-tight", {
  variants: {
    level: {
      1: "text-3xl font-semibold leading-tight",
      2: "text-2xl font-semibold leading-tight",
      3: "text-xl font-semibold leading-snug",
      4: "text-lg font-medium leading-snug",
    },
  },
  defaultVariants: { level: 1 },
});

type HeadingTagProps = HTMLAttributes<HTMLHeadingElement>;

export type HeadingProps = HeadingTagProps & VariantProps<typeof headingStyles>;

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level = 1, className, children, ...rest }, ref) => {
    const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
    return (
      <Tag ref={ref} className={cn(headingStyles({ level }), className)} {...rest}>
        {children}
      </Tag>
    );
  },
);
Heading.displayName = "Heading";
