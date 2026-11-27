"use client";

import React from "react";
import { cn } from "@/lib/utils";

type StatTone = "default" | "navy" | "emerald" | "amber" | "rose" | "sky";

const toneStyles: Record<
  StatTone,
  { card: string; label: string; value: string; iconBg: string }
> = {
  default: {
    card: "border-slate-200/90 bg-white",
    label: "text-slate-500",
    value: "text-slate-900",
    iconBg: "bg-slate-100 text-slate-600",
  },
  navy: {
    card: "border-navy-200/80 bg-navy-50/45",
    label: "text-navy-700",
    value: "text-navy-900",
    iconBg: "bg-navy-100 text-navy-700",
  },
  emerald: {
    card: "border-emerald-200/80 bg-emerald-50/45",
    label: "text-emerald-700",
    value: "text-emerald-800",
    iconBg: "bg-emerald-100 text-emerald-700",
  },
  amber: {
    card: "border-amber-200/80 bg-amber-50/45",
    label: "text-amber-700",
    value: "text-amber-800",
    iconBg: "bg-amber-100 text-amber-700",
  },
  rose: {
    card: "border-rose-200/80 bg-rose-50/45",
    label: "text-rose-700",
    value: "text-rose-800",
    iconBg: "bg-rose-100 text-rose-700",
  },
  sky: {
    card: "border-sky-200/80 bg-sky-50/45",
    label: "text-sky-700",
    value: "text-sky-800",
    iconBg: "bg-sky-100 text-sky-700",
  },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Clean KPI summary card with optional interactive click state. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  active = false,
  onClick,
  className,
}: StatCardProps) {
  const styles = toneStyles[tone];
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all duration-150 shadow-2xs",
        styles.card,
        onClick &&
          "hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500/30 cursor-pointer",
        active && "ring-2 ring-navy-600 border-navy-300 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xs font-medium", styles.label)}>{label}</p>
        {icon && (
          <span
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              styles.iconBg
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className={cn("mt-1.5 text-xl sm:text-2xl font-bold tabular-nums", styles.value)}>
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Comp>
  );
}
