"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/core/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--sync-radius-md)] text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--sync-accent)] text-white hover:bg-[var(--sync-accent-hover)] hover:shadow-[var(--sync-shadow-glow)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--sync-text-secondary)] hover:border-[var(--sync-border-medium)] hover:bg-[var(--sync-bg-surface)] hover:text-[var(--sync-text-primary)]",
        outline:
          "border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] text-[var(--sync-text-primary)] hover:border-[var(--sync-border-medium)]",
        danger:
          "border border-transparent bg-[var(--sync-status-error)] text-white hover:brightness-110",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2.5 text-xs",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
