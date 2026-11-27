"use client";

import React from "react";
import { Database, FileCode2, KeyRound } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { pickLang, useI18n } from "@/lib/i18n";

export default function SetupPage() {
  const { lang } = useI18n();

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="KTX Logo"
              className="h-14 w-14 shrink-0 rounded-full bg-white object-cover shadow-md ring-1 ring-slate-200"
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {pickLang(lang, {
                  th: "ตั้งค่าการเชื่อมต่อฐานข้อมูล Supabase",
                  vi: "Cài đặt kết nối Supabase",
                  en: "Configure Supabase Connection",
                  zh: "配置 Supabase 数据库连接",
                  lo: "ຕັ້ງຄ່າການເຊື່ອມຕໍ່ຖານຂໍ້ມູນ Supabase",
                })}
              </h1>
              <p className="text-sm text-slate-500">
                {pickLang(lang, {
                  th: "ยังไม่พบค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ .env.local",
                  vi: "Chưa tìm thấy NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local",
                  en: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY were not found in .env.local",
                  zh: "在 .env.local 中未检测到 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY",
                  lo: "ຍັງບໍ່ພົບຄ່າ NEXT_PUBLIC_SUPABASE_URL ແລະ NEXT_PUBLIC_SUPABASE_ANON_KEY ໃນໄຟລ໌ .env.local",
                })}
              </p>
            </div>
          </div>

          <LanguageSwitcher variant="dropdown" />
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
            <Database className="h-5 w-5 text-navy-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-slate-900">
                {pickLang(lang, {
                  th: "ขั้นตอนที่ 1: สร้างโปรเจกต์ Supabase และรันสคริปต์ฐานข้อมูล",
                  vi: "Bước 1: Tạo Project trên Supabase & chạy SQL Schema",
                  en: "Step 1: Create Supabase Project & Run SQL Schema",
                  zh: "步骤 1：创建 Supabase 项目并执行 SQL 脚本",
                  lo: "ຂັ້ນຕອນທີ 1: ສ້າງໂປຣເຈັກ Supabase ແລະ ລັນສະຄຣິບຖານຂໍ້ມູນ",
                })}
              </h2>
              <p className="text-slate-600 mt-1">
                {pickLang(lang, {
                  th: "เปิด Supabase Dashboard → SQL Editor → New Query จากนั้นคัดลอกโค้ดทั้งหมดจากไฟล์ supabase/schema.sql ไปรันเพื่อสร้างตาราง ระบบสิทธิ์ RLS และ Storage",
                  vi: "Mở Supabase Dashboard → SQL Editor → New Query, sau đó copy toàn bộ nội dung từ file supabase/schema.sql để tạo bảng, trigger, storage bucket và RLS.",
                  en: "Open Supabase Dashboard → SQL Editor → New Query, then copy and run supabase/schema.sql to create tables, triggers, storage buckets, and RLS policies.",
                  zh: "打开 Supabase Dashboard → SQL Editor → New Query，复制并执行 supabase/schema.sql 以创建数据表、触发器、存储桶与 RLS 策略。",
                  lo: "ເປີດ Supabase Dashboard → SQL Editor → New Query ຈາກນັ້ນຄັດລອກໂຄ້ດຈາກ supabase/schema.sql ໄປລັນເພື່ອສ້າງຕາຕະລາງ ແລະ ສິດ RLS",
                })}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
            <KeyRound className="h-5 w-5 text-navy-600 shrink-0 mt-0.5" />
            <div className="w-full">
              <h2 className="font-semibold text-slate-900">
                {pickLang(lang, {
                  th: "ขั้นตอนที่ 2: สร้างไฟล์ .env.local ที่โฟลเดอร์หลักของโปรเจกต์",
                  vi: "Bước 2: Tạo file .env.local ở thư mục gốc dự án",
                  en: "Step 2: Create .env.local in the project root",
                  zh: "步骤 2：在项目根目录创建 .env.local 文件",
                  lo: "ຂັ້ນຕອນທີ 2: ສ້າງໄຟລ໌ .env.local ຢູ່ໂຟລເດີຫຼັກຂອງໂປຣເຈັກ",
                })}
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
                {pickLang(lang, {
                  th: "ขั้นตอนที่ 3: รีสตาร์ทเซิร์ฟเวอร์และสมัครบัญชีแรก",
                  vi: "Bước 3: Khởi động lại server & đăng ký tài khoản đầu tiên",
                  en: "Step 3: Restart the server & sign in as Admin",
                  zh: "步骤 3：重启服务并登录管理员账号",
                  lo: "ຂັ້ນຕອນທີ 3: ຣີສະຕາດເຊີບເວີ ແລະ ເຂົ້າສູ່ລະບົບບັນຊີຜູ້ດູແລ",
                })}
              </h2>
              <p className="text-slate-600 mt-1">
                {pickLang(lang, {
                  th: "รันคำสั่ง npm run dev ใหม่ แล้วเปิดหน้า /login เพื่อเข้าสู่ระบบด้วยบัญชีผู้ดูแล",
                  vi: "Chạy lại npm run dev rồi vào /login để đăng nhập bằng tài khoản quản trị.",
                  en: "Restart npm run dev and navigate to /login to sign in.",
                  zh: "重新运行 npm run dev 并打开 /login 使用管理员账号登录。",
                  lo: "ລັນຄຳສັ່ງ npm run dev ໃໝ່ ແລ້ວເປີດໜ້າ /login ເພື່ອເຂົ້າສູ່ລະບົບ",
                })}
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
            {pickLang(lang, {
              th: "ตรวจสอบการเชื่อมต่ออีกครั้ง",
              vi: "Kiểm tra lại kết nối",
              en: "Re-check Connection",
              zh: "重新检查连接",
              lo: "ກວດສອບການເຊື່ອມຕໍ່ອີກຄັ້ງ",
            })}
          </button>
        </div>
      </div>
    </div>
  );
}
