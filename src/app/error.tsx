"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dormitory app error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            เกิดข้อผิดพลาดชั่วคราว / Đã xảy ra lỗi tạm thời
          </h1>
          <p className="mt-1 text-xs text-slate-500 break-words">
            {error.message || "Unexpected application error"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            ลองใหม่ / Thử lại
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Home className="h-4 w-4" />
            หน้าหลัก / Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
