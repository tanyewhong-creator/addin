import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-mono text-sm",
    "border transition-colors duration-150",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-addin-line-strong",
  ],
  {
    variants: {
      variant: {
        primary:   "bg-addin-fg text-addin-bg border-addin-fg hover:bg-addin-fg-muted",
        secondary: "bg-addin-bg text-addin-fg border-addin-line-strong hover:bg-addin-bg-elev",
        ghost:     "bg-transparent text-addin-fg border-transparent hover:bg-addin-bg-elev",
      },
      size: {
        sm: "h-6 px-2 text-xs",
        md: "h-8 px-3",
        lg: "h-10 px-4 text-base",
      },
      intent: {
        default: "",
        danger:  "border-addin-danger text-addin-danger hover:bg-addin-danger hover:text-addin-bg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      intent: "default",
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, intent, loading, disabled, className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size, intent }), className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading && <span aria-hidden="true">·</span>}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
