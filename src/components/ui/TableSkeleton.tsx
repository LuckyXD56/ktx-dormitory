"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="grid gap-3 pb-2 border-b border-slate-100" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, idx) => (
          <Skeleton key={`h-${idx}`} className="h-4 w-3/4 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={`r-${rIdx}`}
          className="grid items-center gap-3 py-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, cIdx) => (
            <Skeleton
              key={`c-${rIdx}-${cIdx}`}
              className={cIdx === 0 ? "h-5 w-4/5 rounded-md" : "h-4 w-2/3 rounded-md"}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({
  count = 6,
  columnsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  columnsClass?: string;
}) {
  return (
    <div className={`grid gap-4 ${columnsClass}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-1/2 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-3/4 rounded-md" />
          <Skeleton className="h-3.5 w-2/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}
