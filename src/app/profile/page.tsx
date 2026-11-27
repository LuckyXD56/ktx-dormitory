"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, Loader2, Mail, Phone, Save, ShieldCheck, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LANGUAGE_OPTIONS, pickLang, useI18n } from "@/lib/i18n";
import { updateOwnPassword, updateSelfProfile } from "@/services";
import type { Language } from "@/types/database";

export default function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const { profile, role, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [prefLang, setPrefLang] = useState<Language>("th");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setPrefLang(profile.preferred_language || "th");
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    try {
      await updateSelfProfile(profile.id, {
        full_name: fullName,
        phone,
        preferred_language: prefLang,
      });
      setLang(prefLang);
      await refreshProfile();
      showToast(t.common.successSave, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast(t.profile.newPassword, "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(t.profile.passwordMismatch, "error");
      return;
    }
    setSavingPassword(true);
    try {
      await updateOwnPassword(newPassword);
      setNewPassword("");
      setConfirmPassword("");
      showToast(t.profile.passwordUpdated, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title={t.profile.title}
          subtitle={t.profile.subtitle}
          icon={<User className="h-5 w-5" />}
          badge={
            profile && (
              <Badge variant={profile.is_active ? "emerald" : "rose"}>
                {profile.is_active ? t.users.active : t.users.inactive}
              </Badge>
            )
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="h-4 w-4 text-navy-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {t.profile.accountInfo}
              </h2>
            </div>

            <div className="space-y-1.5">
              <Label>{t.auth.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  value={profile?.email ?? ""}
                  disabled
                  className="pl-10 bg-slate-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t.users.role}</Label>
              <Input
                value={t.roles[role]}
                disabled
                className="bg-slate-50 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-fullname">{t.members.fullName} *</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="profile-fullname"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone">{t.members.phone}</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="profile-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-lang">{t.users.preferredLanguage}</Label>
                <Select
                  id="profile-lang"
                  value={prefLang}
                  onChange={(e) => setPrefLang(e.target.value as Language)}
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.flag} {opt.nativeName} ({opt.shortLabel})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={savingProfile || !profile}>
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingProfile ? t.common.saving : t.common.save}
              </Button>
            </div>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <KeyRound className="h-4 w-4 text-navy-600" />
              <h2 className="text-sm font-bold text-slate-900">
                {t.profile.changePassword}
              </h2>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t.profile.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">{t.profile.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="outline" disabled={savingPassword || !profile}>
                {savingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {savingPassword ? t.common.saving : t.profile.updatePasswordBtn}
              </Button>
            </div>
          </form>
        </div>

        <p className="text-xs text-slate-400">
          {pickLang(lang, {
            th: "การเปลี่ยนแปลงทั้งหมดเชื่อมต่อและซิงค์โดยตรงกับ Supabase Auth & Profiles",
            vi: "Mọi thay đổi được đồng bộ trực tiếp với Supabase Auth & Profiles.",
            en: "All changes sync directly with Supabase Auth & Profiles.",
            zh: "所有更改将直接同步至 Supabase Auth 与个人资料。",
            lo: "ການປ່ຽນແປງທັງໝົດຈະຊິງຄ໌ໂດຍກົງກັບ Supabase Auth & Profiles",
          })}
        </p>
      </div>
    </AppShell>
  );
}
