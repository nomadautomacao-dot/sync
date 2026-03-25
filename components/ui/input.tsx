import * as React from "react";
import { cn } from "@/core/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] px-3 py-2 text-sm text-[var(--sync-text-primary)] transition-all duration-150 placeholder:text-[var(--sync-text-tertiary)] focus-visible:border-[var(--sync-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sync-accent-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
