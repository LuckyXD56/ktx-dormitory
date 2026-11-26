"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, UserCog } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Language, Profile, UserRole } from "@/types/database";

export default function UsersPage() {
  const { t } = useI18n();
  const { profile: currentProfile, isAdminOrAbove, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [prefLang, setPrefLang] = useState<Language>("th");
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      setUsers((data as Profile[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t.users.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.users.subtitle}</p>
          </div>
          {isAdminOrAbove && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <Plus className="h-4 w-4" />
              {t.users.addUser}
            </button>
          )}
        </div>

        {!isAdminOrAbove ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            {t.common.noPermission}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-navy-600" />
                <span className="text-sm">{t.common.loading}</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">{t.members.fullName}</th>
                      <th className="px-4 py-3">{t.auth.email}</th>
                      <th className="px-4 py-3">{t.users.role}</th>
                      <th className="px-4 py-3">{t.users.activeStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => {
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
                            <select
                              disabled={isSelf || lockedSuper}
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(u, e.target.value as UserRole)
                              }
                              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:bg-slate-100"
                            >
                              {isSuperAdmin && (
                                <option value="super_admin">
                                  {t.roles.super_admin}
                                </option>
                              )}
                              <option value="admin">{t.roles.admin}</option>
                              <option value="staff">{t.roles.staff}</option>
                            </select>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                <option value="th">🇹🇭 ไทย</option>
                <option value="vi">🇻🇳 Tiếng Việt</option>
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
    </AppShell>
  );
}
