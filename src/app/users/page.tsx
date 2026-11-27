"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, Check, Copy, Download, KeyRound, Plus, Search, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/StatCard";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { LANGUAGE_OPTIONS, pickLang, useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { emitDormSync, subscribeDormSync } from "@/lib/cache";
import { listProfiles } from "@/services";
import type { Language, Profile, UserRole } from "@/types/database";

export default function UsersPage() {
  const { t, lang } = useI18n();
  const { profile: currentProfile, isAdminOrAbove, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [prefLang, setPrefLang] = useState<Language>("th");
  const [creating, setCreating] = useState(false);

  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [tab, setTab] = useState<"staff" | "rooms">("staff");
  const [generatingRooms, setGeneratingRooms] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<
    { building: string; room_number: string; email: string; password: string }[]
  >([]);
  const [credsOpen, setCredsOpen] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [resettingPwd, setResettingPwd] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listProfiles();
      setUsers(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadUsers();
    });
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const base =
      tab === "rooms"
        ? users.filter((u) => u.role === "student")
        : users.filter((u) => u.role !== "student");
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search, tab]);

  const userStats = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    const admins = users.filter(
      (u) => u.role === "super_admin" || u.role === "admin"
    ).length;
    const staff = users.filter((u) => u.role === "staff").length;
    const students = users.filter((u) => u.role === "student").length;
    return { total: users.length, active, admins, staff, students };
  }, [users]);

  const handleRoleChange = async (target: Profile, nextRole: UserRole) => {
    if (!isSuperAdmin && (target.role === "super_admin" || nextRole === "super_admin")) {
      showToast(t.common.noPermission, "error");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("profiles")
      .update({ role: nextRole })
      .eq("id", target.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(t.common.successSave, "success");
    await loadUsers();
  };

  const handleToggleActive = async (target: Profile) => {
    if (target.id === currentProfile?.id) return;
    if (!isSuperAdmin && target.role === "super_admin") {
      showToast(t.common.noPermission, "error");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !target.is_active })
      .eq("id", target.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(t.common.successSave, "success");
    await loadUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          phone,
          role,
          preferred_language: prefLang,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "SERVICE_ROLE_MISSING") {
          showToast(t.users.createInfo, "info");
        } else {
          showToast(json.error || t.common.errorGeneric, "error");
        }
        return;
      }
      showToast(t.common.successSave, "success");
      setAddOpen(false);
      setFullName("");
      setEmail("");
      setPassword("");
      setPhone("");
      await loadUsers();
      emitDormSync("profiles");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deletingUser.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "SERVICE_ROLE_MISSING") {
          showToast(t.users.createInfo, "info");
        } else {
          showToast(json.error || t.common.errorGeneric, "error");
        }
        return;
      }
      showToast(t.common.successDelete, "success");
      setDeletingUser(null);
      await loadUsers();
      emitDormSync("profiles");
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateRoomAccounts = async () => {
    setGeneratingRooms(true);
    try {
      const res = await fetch("/api/room-accounts", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "SERVICE_ROLE_MISSING") {
          showToast(t.users.createInfo, "info");
        } else {
          showToast(json.error || t.common.errorGeneric, "error");
        }
        return;
      }
      const list = json.created ?? [];
      if (list.length === 0) {
        showToast(t.common.successSave, "success");
      } else {
        setCreatedCredentials(list);
        setCredsOpen(true);
        setTab("rooms");
      }
      await loadUsers();
      emitDormSync("profiles");
    } finally {
      setGeneratingRooms(false);
    }
  };

  const handleResetRoomPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || resetPasswordVal.length < 6) return;
    setResettingPwd(true);
    try {
      const res = await fetch("/api/room-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetTarget.id,
          password: resetPasswordVal,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || t.common.errorGeneric, "error");
        return;
      }
      showToast(t.profile.passwordUpdated, "success");
      setResetTarget(null);
      setResetPasswordVal("");
    } finally {
      setResettingPwd(false);
    }
  };

  const handleCopyCredentials = async () => {
    const csv = [
      "Building\tRoom\tEmail\tPassword",
      ...createdCredentials.map(
        (c) => `${c.building}\t${c.room_number}\t${c.email}\t${c.password}`
      ),
    ].join("\n");
    await navigator.clipboard.writeText(csv);
    setCopiedCreds(true);
    window.setTimeout(() => setCopiedCreds(false), 2000);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.users.title}
          subtitle={t.users.subtitle}
          actions={
            isAdminOrAbove ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={generatingRooms}
                  onClick={handleGenerateRoomAccounts}
                >
                  <BedDouble className="h-4 w-4" />
                  {generatingRooms
                    ? t.common.loading
                    : t.studentPortal.generateRoomAccounts}
                </Button>
                <Button type="button" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t.users.addUser}
                </Button>
              </div>
            ) : undefined
          }
        />

        {!isAdminOrAbove ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            {t.common.noPermission}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label={pickLang(lang, {
                  th: "บัญชีทั้งหมด",
                  vi: "Tổng tài khoản",
                  en: "Total Accounts",
                  zh: "账号总数",
                  lo: "ບັນຊີທັງໝົດ",
                })}
                value={userStats.total}
                icon={<Users className="h-4 w-4" />}
              />
              <StatCard
                tone="emerald"
                label={t.users.active}
                value={userStats.active}
              />
              <StatCard
                tone="navy"
                label={t.roles.admin}
                value={userStats.admins}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <StatCard
                label={t.roles.staff}
                value={userStats.staff}
              />
              <StatCard
                tone="amber"
                label={t.studentPortal.roomAccountsTab}
                value={userStats.students}
                icon={<BedDouble className="h-4 w-4" />}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setTab("staff")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    tab === "staff"
                      ? "bg-navy-700 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.studentPortal.staffAccountsTab} ({userStats.admins + userStats.staff})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("rooms")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    tab === "rooms"
                      ? "bg-navy-700 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.studentPortal.roomAccountsTab} ({userStats.students})
                </button>
              </div>
              {tab === "rooms" && (
                <p className="text-xs text-slate-500">
                  {t.studentPortal.roomAccountsInfo}
                </p>
              )}
            </div>

            <FilterBar
              hasActiveFilters={Boolean(search.trim())}
              onReset={() => setSearch("")}
              resetLabel={t.common.reset}
            >
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.common.search}
                  className="pl-10"
                />
              </div>
            </FilterBar>

            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
              {loading ? (
                <TableSkeleton rows={4} cols={5} />
              ) : filteredUsers.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title={t.common.noData}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">{t.members.fullName}</th>
                        <th className="px-4 py-3">{t.auth.email}</th>
                        <th className="px-4 py-3">{t.users.role}</th>
                        <th className="px-4 py-3">{t.users.activeStatus}</th>
                        <th className="px-4 py-3 text-right">{t.common.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => {
                        const isSelf = u.id === currentProfile?.id;
                        const lockedSuper =
                          u.role === "super_admin" && !isSuperAdmin;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-navy-600" />
                                <span className="font-semibold text-slate-900">
                                  {u.full_name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {u.email}
                            </td>
                            <td className="px-4 py-3">
                              {u.role === "student" ? (
                                <Badge variant="sky">{t.roles.student}</Badge>
                              ) : (
                                <Select
                                  disabled={isSelf || lockedSuper}
                                  value={u.role}
                                  onChange={(e) =>
                                    handleRoleChange(u, e.target.value as UserRole)
                                  }
                                  className="h-8 w-auto min-w-[160px] text-xs font-medium"
                                >
                                  {isSuperAdmin && (
                                    <option value="super_admin">
                                      {t.roles.super_admin}
                                    </option>
                                  )}
                                  <option value="admin">{t.roles.admin}</option>
                                  <option value="staff">{t.roles.staff}</option>
                                </Select>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                disabled={isSelf || lockedSuper}
                                onClick={() => handleToggleActive(u)}
                                className="disabled:opacity-60"
                              >
                                <Badge
                                  variant={u.is_active ? "emerald" : "rose"}
                                >
                                  {u.is_active
                                    ? t.users.active
                                    : t.users.inactive}
                                </Badge>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {u.role === "student" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetTarget(u);
                                      setResetPasswordVal("");
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-navy-200 bg-navy-50 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
                                  >
                                    <KeyRound className="h-3.5 w-3.5" />
                                    <span>{t.studentPortal.resetRoomPassword}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isSelf || lockedSuper}
                                  onClick={() => setDeletingUser(u)}
                                  title={
                                    isSelf || lockedSuper
                                      ? t.common.noPermission
                                      : t.common.delete
                                  }
                                  aria-label={`${t.common.delete} ${u.email}`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>{t.common.delete}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t.users.addUser}
        subtitle={t.users.createInfo}
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.auth.fullName} *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.auth.email} *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.auth.password} *
              </label>
              <input
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.users.role}
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="staff">{t.roles.staff}</option>
                <option value="admin">{t.roles.admin}</option>
                {isSuperAdmin && (
                  <option value="super_admin">{t.roles.super_admin}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.users.preferredLanguage}
              </label>
              <select
                value={prefLang}
                onChange={(e) => setPrefLang(e.target.value as Language)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.flag} {opt.nativeName} ({opt.shortLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <ShieldCheck className="h-4 w-4" />
              {creating ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={t.studentPortal.resetRoomPassword}
        subtitle={resetTarget ? `${resetTarget.full_name} (${resetTarget.email})` : undefined}
        maxWidth="sm"
      >
        <form onSubmit={handleResetRoomPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.profile.newPassword}
            </label>
            <input
              type="text"
              minLength={6}
              required
              value={resetPasswordVal}
              onChange={(e) => setResetPasswordVal(e.target.value)}
              placeholder="Ktx@123456"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={resettingPwd}>
              <KeyRound className="h-4 w-4" />
              {resettingPwd ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={credsOpen}
        onClose={() => setCredsOpen(false)}
        title={t.studentPortal.credentialsModalTitle}
        subtitle={t.studentPortal.credentialsModalSubtitle}
        maxWidth="lg"
      >
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleCopyCredentials}>
              {copiedCreds ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCreds ? t.common.successSave : "Copy"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const csv = [
                  "Building,Room,Email,Password",
                  ...createdCredentials.map(
                    (c) => `"${c.building}","${c.room_number}","${c.email}","${c.password}"`
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "ktx-room-accounts.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">{t.common.building}</th>
                  <th className="px-3 py-2">{t.common.room}</th>
                  <th className="px-3 py-2">{t.auth.email}</th>
                  <th className="px-3 py-2">{t.auth.password}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {createdCredentials.map((c) => (
                  <tr key={c.email}>
                    <td className="px-3 py-2">{c.building}</td>
                    <td className="px-3 py-2 font-medium">{c.room_number}</td>
                    <td className="px-3 py-2 font-mono">{c.email}</td>
                    <td className="px-3 py-2 font-mono font-bold text-navy-700">{c.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => !deleting && setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        loading={deleting}
        description={
          deletingUser
            ? pickLang(lang, {
                th: `ยืนยันการลบบัญชี "${deletingUser.full_name}" (${deletingUser.email})? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
                vi: `Xác nhận xóa tài khoản "${deletingUser.full_name}" (${deletingUser.email})? Thao tác này không thể hoàn tác.`,
                en: `Delete account "${deletingUser.full_name}" (${deletingUser.email})? This action cannot be undone.`,
                zh: `确认删除账号 "${deletingUser.full_name}" (${deletingUser.email})？此操作无法撤销。`,
                lo: `ຢືນຢັນການລຶບບັນຊີ "${deletingUser.full_name}" (${deletingUser.email})? ການດຳເນີນການນີ້ບໍ່ສາມາດຍ້ອນກັບໄດ້`,
              })
            : undefined
        }
      />
    </AppShell>
  );
}
