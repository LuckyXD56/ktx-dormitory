"use client";

import React from "react";
import { Database, FileCode2, Globe, KeyRound, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function SetupPage() {
  const { lang, setLang } = useI18n();

  const isVi = lang === "vi";

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-600 text-white shadow-lg">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {isVi
                  ? "Cài đặt kết nối Supabase"
                  : "ตั้งค่าการเชื่อมต่อฐานข้อมูล Supabase"}
              </h1>
              <p className="text-sm text-slate-500">
                {isVi
                  ? "Chưa tìm thấy NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local"
                  : "ยังไม่พบค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ .env.local"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLang(isVi ? "th" : "vi")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-slate-50"
          >
            <Globe className="h-4 w-4 text-navy-600" />
            {isVi ? "🇹🇭 ไทย" : "🇻🇳 Tiếng Việt"}
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
            <Database className="h-5 w-5 text-navy-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-slate-900">
                {isVi
                  ? "Bước 1: Tạo Project trên Supabase & chạy SQL Schema"
                  : "ขั้นตอนที่ 1: สร้างโปรเจกต์ Supabase และรันสคริปต์ฐานข้อมูล"}
              </h2>
              <p className="text-slate-600 mt-1">
                {isVi
                  ? "Mở Supabase Dashboard → SQL Editor → New Query, sau đó copy toàn bộ nội dung từ file supabase/schema.sql để tạo bảng, trigger, storage bucket và RLS. (Có thể chạy thêm supabase/seed.sql để có dữ liệu mẫu)."
                  : "เปิด Supabase Dashboard → SQL Editor → New Query จากนั้นคัดลอกโค้ดทั้งหมดจากไฟล์ supabase/schema.sql ไปรันเพื่อสร้างตาราง ระบบสิทธิ์ RLS และ Storage (สามารถรัน supabase/seed.sql เพิ่มเพื่อใส่ข้อมูลตัวอย่างได้)"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
            <KeyRound className="h-5 w-5 text-navy-600 shrink-0 mt-0.5" />
            <div className="w-full">
              <h2 className="font-semibold text-slate-900">
                {isVi
                  ? "Bước 2: Tạo file .env.local ở thư mục gốc dự án"
                  : "ขั้นตอนที่ 2: สร้างไฟล์ .env.local ที่โฟลเดอร์หลักของโปรเจกต์"}
              </h2>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-emerald-300">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-optional`}
              </pre>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
            <FileCode2 className="h-5 w-5 text-navy-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-slate-900">
                {isVi
                  ? "Bước 3: Khởi động lại server & đăng ký tài khoản đầu tiên"
                  : "ขั้นตอนที่ 3: รีสตาร์ทเซิร์ฟเวอร์และสมัครบัญชีแรก"}
              </h2>
              <p className="text-slate-600 mt-1">
                {isVi
                  ? "Chạy lại npm run dev rồi vào /login để đăng ký. Tài khoản đăng ký đầu tiên sẽ tự động trở thành Super Admin!"
                  : "รันคำสั่ง npm run dev ใหม่ แล้วเปิดหน้า /login เพื่อลงทะเบียน ผู้ใช้คนแรกของระบบจะได้รับสิทธิ์ Super Admin โดยอัตโนมัติ"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
          >
            {isVi ? "Kiểm tra lại kết nối" : "ตรวจสอบการเชื่อมต่ออีกครั้ง"}
          </button>
        </div>
      </div>
    </div>
  );
}
