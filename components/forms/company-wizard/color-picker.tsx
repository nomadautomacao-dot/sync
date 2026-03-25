"use client";

import { cn } from "@/core/lib/utils";

const COLORS = [
  "#6366F1",
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#06B6D4",
] as const;

interface ColorPickerProps {
  value?: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((color) => {
        const active = value?.toUpperCase() === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-all",
              active ? "border-[var(--sync-accent)] scale-105" : "border-transparent",
            )}
            style={{ backgroundColor: color }}
            aria-label={`Selecionar cor ${color}`}
          />
        );
      })}
    </div>
  );
}
