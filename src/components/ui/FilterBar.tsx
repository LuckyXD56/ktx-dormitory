"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: React.ReactNode;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
}

/** Consistent surface card for search inputs, filters, and quick reset. */
export function FilterBar({
  children,
  hasActiveFilters = false,
  onReset,
  resetLabel = "Reset",
  className,
}: FilterBarProps) {
  return (
    <div
      className={cn(
        "no-print rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs",
        className
      )}
    >
      <div className="flex flex-col gap-3">
        {children}
        {hasActiveFilters && onReset && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-navy-600 hover:bg-navy-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resetLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
