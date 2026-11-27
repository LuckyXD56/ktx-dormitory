"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Globe,
  Keyboard,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { pickLang, useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import { updateSelfProfile } from "@/services";
import type { Language } from "@/types/database";

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { profile, role, isAdminOrAbove, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [updatingLang, setUpdatingLang] = useState(false);

  const handleSelectLanguage = async (next: Language) => {
    setLang(next);
    if (!profile) return;
    setUpdatingLang(true);
    try {
      await updateSelfProfile(profile.id, {
        full_name: profile.full_name,
        phone: profile.phone ?? "",
        preferred_language: next,
      });
      await refreshProfile();
      showToast(t.common.successSave, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setUpdatingLang(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title={t.settings.title}
          subtitle={t.settings.subtitle}
          icon={<Settings className="h-5 w-5" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Globe className="h-4 w-4 text-navy-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {t.settings.languageTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t.settings.languageDesc}
            </p>
            <LanguageSwitcher
              variant="pills"
              disabled={updatingLang}
              onSelect={handleSelectLanguage}
              className="!justify-start"
            />
            <div className="rounded-xl bg-slate-50 border border-slate-200/70 px-3.5 py-2.5 text-xs text-slate-600 flex items-center justify-between">
              <span>{t.common.currency}</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {formatCurrency(2500000, lang)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Keyboard className="h-4 w-4 text-navy-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {t.settings.shortcutsTitle}
              </h2>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-slate-700">
                  {pickLang(lang, {
                    th: "เปิดค้นหาด่วน (Command Palette)",
                    vi: "Mở tìm kiếm nhanh",
                    en: "Open Quick Search (Command Palette)",
                    zh: "打开快速搜索 (命令面板)",
                    lo: "ເປີດຄົ້ນຫາດ່ວນ (Command Palette)",
                  })}
                </span>
                <kbd className="rounded-md border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-slate-700">
                  {pickLang(lang, {
                    th: "โฟกัสช่องค้นหาเมนูด้านข้าง",
                    vi: "Tìm kiếm menu bên trái",
                    en: "Focus sidebar navigation filter",
                    zh: "聚焦左侧菜单搜索",
                    lo: "ໂຟກັສຊ່ອງຄົ້ນຫາເມນູດ້ານຂ້າງ",
                  })}
                </span>
                <kbd className="rounded-md border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                  /
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-navy-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {t.settings.systemAccessTitle}
              </h2>
            </div>
            <Badge variant="navy">{t.roles[role]}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/profile"
              className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-xs font-semibold text-slate-700 hover:border-navy-200 hover:bg-navy-50/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-navy-600" />
                {t.nav.profile}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
            {isAdminOrAbove && (
              <Link
                href="/users"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-xs font-semibold text-slate-700 hover:border-navy-200 hover:bg-navy-50/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-navy-600" />
                  {t.nav.users}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            )}
            <Link
              href="/glassy-demo"
              className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100/60 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                {t.nav.glassyView}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-indigo-500" />
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
