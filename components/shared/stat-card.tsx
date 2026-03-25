import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: number | string;
  helper: ReactNode;
  icon: ReactNode;
  index?: number;
}

export function StatCard({ label, value, helper, icon, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Card>
        <CardContent className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-[var(--sync-text-tertiary)]">
              {label}
            </p>
            <p className="mt-2 text-[clamp(1.55rem,1.7vw,2.2rem)] font-semibold leading-tight tracking-tight text-[var(--sync-text-primary)] [font-variant-numeric:tabular-nums]">
              {value}
            </p>
            <p className="mt-1 text-xs text-[var(--sync-text-secondary)]">{helper}</p>
          </div>
          <div className="shrink-0 rounded-[var(--sync-radius-md)] border border-[var(--sync-border-subtle)] bg-[var(--sync-bg-surface)] p-2 text-[var(--sync-text-secondary)]">
            {icon}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
