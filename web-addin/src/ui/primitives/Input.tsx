import { forwardRef, type InputHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const inputStyles = cva(
  [
    "w-full font-mono text-sm",
    "bg-addin-bg text-addin-fg",
    "border border-addin-line",
    "px-3 py-1.5",
    "transition-colors duration-150",
    "placeholder:text-addin-fg-faint",
    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-addin-line-strong",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      size: {
        sm: "h-6 text-xs px-2",
        md: "h-8",
        lg: "h-10 text-base",
      },
      invalid: {
        true: "border-addin-danger",
        false: "",
      },
    },
    defaultVariants: { size: "md", invalid: false },
  },
);

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputStyles>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size, invalid, className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(inputStyles({ size, invalid }), className)}
      {...rest}
    />
  ),
);
Input.displayName = "Input";
