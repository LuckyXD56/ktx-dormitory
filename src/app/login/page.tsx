"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { ConstellationCanvas } from "@/components/auth/ConstellationCanvas";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/providers/ToastProvider";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { showToast } = useToast();
  const heroRef = useRef<HTMLElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inactiveNotice, setInactiveNotice] = useState(false);

  const isVi = lang === "vi";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("inactive") === "1") {
        setInactiveNotice(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      window.location.href = "/setup";
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        showToast(error.message, "error");
        return;
      }
      if (data.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("id", data.user.id)
          .single();
        if (prof && prof.is_active === false) {
          await supabase.auth.signOut();
          showToast(t.auth.inactiveAccount, "error");
          return;
        }
        window.location.href = "/";
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotInfo = () => {
    showToast(
      isVi
        ? "Vui lòng liên hệ Quản trị viên KTX (Admin) để được cấp lại mật khẩu."
        : "กรุณาติดต่อผู้ดูแลระบบหอพัก (Admin) เพื่อขอรีเซ็ตรหัสผ่านใหม่",
      "info"
    );
  };

  const features = [
    {
      icon: Building2,
      accent: "bg-amber-400 text-[#0a2f66]",
      mobileAccent: "bg-amber-50 text-amber-600 border border-amber-200/80",
      title: isVi ? "Quản lý phòng ở & sinh viên" : "จัดการห้องพักและนักศึกษา",
      desc: isVi
        ? "Theo dõi giường trống, tòa nhà và hồ sơ nội trú theo thời gian thực"
        : "ติดตามเตียงว่าง อาคาร และข้อมูลผู้พักอาศัยแบบเรียลไทม์",
    },
    {
      icon: ClipboardCheck,
      accent: "bg-white text-[#0d4a96]",
      mobileAccent: "bg-blue-50 text-[#0d4a96] border border-blue-200/80",
      title: isVi ? "Điểm danh & quản lý lệ phí" : "เช็กชื่อเข้า-ออก & ค่าธรรมเนียม",
      desc: isVi
        ? "Kiểm soát ra/vào ký túc xá, xuất hóa đơn tháng và in biên lai VND"
        : "บันทึกเวลาเข้าหอ ออกบิลรายเดือน และพิมพ์ใบเสร็จสกุลเงิน VND",
    },
  ];

  const moduleChips = [
    { icon: Building2, label: isVi ? "Phòng & Tòa nhà" : "อาคารและห้องพัก" },
    { icon: ClipboardCheck, label: isVi ? "Điểm danh" : "เช็กชื่อเข้า-ออก" },
    { icon: CreditCard, label: isVi ? "Thu phí VND" : "ค่าธรรมเนียม VND" },
    { icon: FileSpreadsheet, label: isVi ? "Báo cáo" : "รายงาน Excel/PDF" },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2 bg-[#f5f8fc]">
      {/* Left Brand Showcase (Desktop) & Top Hero Strip (Mobile) */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-gradient-to-br from-[#0b3c7d] via-[#0d4b97] to-[#072652] text-white lg:border-r-[3px] lg:border-amber-400/90 px-6 pt-8 pb-12 sm:px-10 lg:px-14 lg:py-12 flex flex-col justify-center"
      >
        {/* Interactive Drifting Constellation & Stars */}
        <ConstellationCanvas containerRef={heroRef} />

        {/* Subtle Ambient Radial Nebula Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl animate-pulse"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl animate-pulse"
        />

        <div className="relative z-10 max-w-lg mx-auto lg:mx-0 w-full space-y-6">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
            <span className="h-[2px] w-6 rounded-full bg-amber-400" />
            <span>
              {isVi
                ? "ĐÔ THỊ QUẢN SINH VIÊN • KÝ TÚC XÁ"
                : "KTX CONTROL • ระบบจัดการหอพัก"}
            </span>
          </div>

          {/* Main Headline */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl lg:text-[40px] font-bold leading-[1.18] tracking-tight text-white">
              {isVi ? (
                <>
                  Hệ thống quản lý{" "}
                  <span className="text-amber-400">Ký túc xá sinh viên</span>
                </>
              ) : (
                <>
                  ระบบบริหารจัดการ{" "}
                  <span className="text-amber-400">หอพักนักศึกษา</span>
                </>
              )}
            </h1>
            <p className="text-sm sm:text-base text-blue-100/85 font-medium">
              {isVi
                ? "Trường Đại học Sư phạm - Đại học Đà Nẵng"
                : "Trường Đại học Sư phạm - Đại học Đà Nẵng (UED)"}
            </p>
          </div>

          {/* Desktop Feature Cards */}
          <div className="hidden lg:flex flex-col gap-3 pt-1">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="flex items-center gap-3.5 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-3.5 transition-colors hover:bg-white/15"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${feat.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white leading-snug">
                      {feat.title}
                    </h2>
                    <p className="text-xs text-blue-100/80 mt-0.5">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Module Chips */}
          <div className="hidden lg:block space-y-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-200/70">
              {isVi ? "CHỨC NĂNG CHÍNH TRONG HỆ THỐNG" : "โมดูลหลักในระบบ"}
            </p>
            <div className="flex flex-wrap gap-2">
              {moduleChips.map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-blue-50"
                  >
                    <ChipIcon className="h-3.5 w-3.5 text-amber-300" />
                    {chip.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Desktop Security Notice */}
          <div className="hidden lg:block border-l-2 border-amber-400 pl-3.5 py-0.5 text-xs text-blue-100/80 leading-relaxed">
            {isVi
              ? "Đăng nhập bằng tài khoản cán bộ được Quản trị viên cấp quyền. Mọi thao tác đều được đồng bộ và bảo mật theo phân quyền."
              : "เข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่ที่ได้รับสิทธิ์จากผู้ดูแลระบบเท่านั้น ทุกข้อมูลเชื่อมต่อและป้องกันสิทธิ์ระดับฐานข้อมูล"}
          </div>
        </div>
      </section>

      {/* Right Login Card Panel (Desktop) & Rounded Sheet (Mobile) */}
      <section className="relative flex-1 flex flex-col items-center justify-center -mt-6 lg:mt-0 rounded-t-[28px] lg:rounded-none bg-gradient-to-br from-[#fafbfd] via-[#f4f7fc] to-[#ebf1f8] px-5 py-8 sm:px-8 lg:px-12 shadow-xl lg:shadow-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden lg:block opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(rgba(13, 75, 151, 0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 w-full max-w-[420px] animate-fade-up">
          <div className="lg:rounded-2xl lg:bg-white lg:border lg:border-slate-200/85 lg:shadow-[0_20px_50px_-15px_rgba(9,35,77,0.14)] overflow-hidden">
            {/* Gold-to-Royal-Blue Top Accent Bar */}
            <div className="hidden lg:block h-1.5 w-full bg-gradient-to-r from-amber-400 via-amber-300 to-[#0d4b97]" />

            <div className="lg:p-8 space-y-6">
              {/* University Crest & Identity */}
              <div className="flex items-center justify-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt={t.appName}
                  className="h-12 w-12 shrink-0 rounded-full bg-white object-cover shadow-sm ring-1 ring-slate-200"
                />
                <div className="text-left leading-tight">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    ĐẠI HỌC ĐÀ NẴNG
                  </p>
                  <p className="text-xs sm:text-[13px] font-extrabold uppercase tracking-wide text-[#0a3673]">
                    TRƯỜNG ĐẠI HỌC SƯ PHẠM
                  </p>
                </div>
              </div>

              {/* Greeting */}
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-[#0a3673]">
                  {isVi ? "Chào mừng trở lại" : "ยินดีต้อนรับกลับมา"}
                </h2>
                <p className="text-sm text-slate-500">
                  {isVi
                    ? "Đăng nhập vào Hệ thống Quản lý Ký túc xá"
                    : "เข้าสู่ระบบจัดการหอพักนักศึกษา (KTX)"}
                </p>
              </div>

              {inactiveNotice && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{t.auth.inactiveAccount}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    {isVi ? "Tài khoản / Email" : t.auth.email}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@dormitory.local"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:border-[#0d4b97] focus:outline-none focus:ring-2 focus:ring-[#0d4b97]/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    {t.auth.password}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isVi ? "Nhập mật khẩu" : "กรอกรหัสผ่าน"}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:bg-white focus:border-[#0d4b97] focus:outline-none focus:ring-2 focus:ring-[#0d4b97]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotInfo}
                    className="text-xs font-semibold text-[#0d4b97] hover:text-[#083066] hover:underline"
                  >
                    {isVi ? "Quên mật khẩu?" : "ลืมรหัสผ่าน?"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0d509e] text-sm font-semibold text-white shadow-md shadow-[#0d509e]/25 hover:bg-[#0a4182] active:scale-[0.99] disabled:opacity-50 transition-all"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  <span>{t.auth.signIn}</span>
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>

              {/* Language Switcher Pill */}
              <div className="pt-2 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLang(isVi ? "th" : "vi")}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50/90 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-[#0d4b97]" />
                  <span>{isVi ? "Tiếng Việt (vi)" : "ภาษาไทย (th)"}</span>
                </button>
                <p className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <ShieldCheck className="h-3 w-3 text-[#0d4b97]" />
                  <span>
                    {isVi
                      ? "Tài khoản do Quản trị viên cấp"
                      : "เข้าใช้งานเฉพาะบัญชีที่ Admin กำหนดเท่านั้น"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Feature Summary Cards (shown below login form on small screens) */}
          <div className="mt-7 space-y-3 lg:hidden border-t border-slate-200/80 pt-5">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${feat.mobileAccent}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {feat.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {feat.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
