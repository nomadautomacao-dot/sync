import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/core/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--sync-radius-sm)] border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-[var(--sync-border-medium)] bg-[var(--sync-bg-surface)] text-[var(--sync-text-secondary)]",
        active:
          "border-transparent bg-[color:color-mix(in_srgb,var(--sync-status-active)_20%,transparent)] text-[var(--sync-status-active)]",
        warning:
          "border-transparent bg-[color:color-mix(in_srgb,var(--sync-status-warning)_20%,transparent)] text-[var(--sync-status-warning)]",
        error:
          "border-transparent bg-[color:color-mix(in_srgb,var(--sync-status-error)_20%,transparent)] text-[var(--sync-status-error)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
