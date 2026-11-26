import React from "react";
import Link from "next/link";
import { Building2, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-widest text-primary uppercase">
            404
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">
            ไม่พบหน้าที่ต้องการ / Không tìm thấy trang
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            ตรวจสอบ URL อีกครั้ง หรือกลับไปยังหน้าแดชบอร์ดหลัก
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <Home className="h-4 w-4" />
            กลับหน้าหลัก / Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
