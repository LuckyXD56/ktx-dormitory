"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Edit2,
  Eye,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { listMembers, listViolations } from "@/services";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { formatDateTime } from "@/lib/utils";
import type {
  Member,
  Violation,
  ViolationSeverity,
  ViolationStatus,
} from "@/types/database";

const VIOLATION_TYPES = [
  "curfew",
  "noise",
  "prohibited_items",
  "cleanliness",
  "property_damage",
  "conflict",
  "other",
] as const;

export default function ViolationsPage() {
  const { t, lang } = useI18n();
  const { user, isAdminOrAbove } = useAuth();
  const { showToast } = useToast();

  const initialViol = getCached<{
    violations: Violation[];
    members: Member[];
  }>("violations_page");
  const [violations, setViolations] = useState<Violation[]>(
    initialViol?.violations ?? []
  );
  const [members, setMembers] = useState<Member[]>(initialViol?.members ?? []);
  const [loading, setLoading] = useState(!initialViol);

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Violation | null>(null);
  const [vMemberId, setVMemberId] = useState("");
  const [vType, setVType] = useState("curfew");
  const [vSeverity, setVSeverity] = useState<ViolationSeverity>("low");
  const [vOccurredAt, setVOccurredAt] = useState("");
  const [vDescription, setVDescription] = useState("");
  const [vEvidenceUrl, setVEvidenceUrl] = useState("");
  const [vPenalty, setVPenalty] = useState("");
  const [vStatus, setVStatus] = useState<ViolationStatus>("pending");
  const [saving, setSaving] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("violations_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("violations_page")) setLoading(true);
    try {
      const [vData, mData] = await Promise.all([
        listViolations(),
        listMembers({ orderBy: "full_name", ascending: true }),
      ]);
      const payload = {
        violations: vData,
        members: mData,
      };
      setViolations(payload.violations);
      setMembers(payload.members);
      setCached("violations_page", payload);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadData(true);
    });
  }, [loadData]);

  const refreshViolations = async () => {
    invalidateCache("violations_page");
    invalidateCache("dashboard_page");
    emitAlertsRefresh();
    await loadData(true);
  };

  const typeLabel = (vt: string) => {
    switch (vt) {
      case "curfew":
        return t.violations.typeCurfew;
      case "noise":
        return t.violations.typeNoise;
      case "prohibited_items":
        return t.violations.typeProhibited;
      case "cleanliness":
        return t.violations.typeCleanliness;
      case "property_damage":
        return t.violations.typeDamage;
      case "conflict":
        return t.violations.typeConflict;
      default:
        return t.violations.typeOther;
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return violations.filter((v) => {
      if (severityFilter !== "all" && v.severity !== severityFilter) return false;
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (q) {
        const match =
          (v.member?.full_name ?? "").toLowerCase().includes(q) ||
          (v.member?.student_code ?? "").toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.penalty.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [violations, search, severityFilter, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setVMemberId(members[0]?.id ?? "");
    setVType("curfew");
    setVSeverity("low");
    const now = new Date();
    setVOccurredAt(
      new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    );
    setVDescription("");
    setVEvidenceUrl("");
    setVPenalty("");
    setVStatus("pending");
    setModalOpen(true);
  };

  const openEdit = (v: Violation) => {
    setEditing(v);
    setVMemberId(v.member_id);
    setVType(v.violation_type);
    setVSeverity(v.severity);
    const dt = new Date(v.occurred_at);
    setVOccurredAt(
      new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    );
    setVDescription(v.description);
    setVEvidenceUrl(v.evidence_url ?? "");
    setVPenalty(v.penalty);
    setVStatus(v.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const payload = {
        member_id: vMemberId,
        violation_type: vType,
        severity: vSeverity,
        occurred_at: vOccurredAt
          ? new Date(vOccurredAt).toISOString()
          : new Date().toISOString(),
        description: vDescription.trim(),
        evidence_url: vEvidenceUrl.trim() || null,
        penalty: vPenalty.trim(),
        status: vStatus,
        recorded_by: user.id,
      };
      const { error } = editing
        ? await supabase.from("violations").update(payload).eq("id", editing.id)
        : await supabase.from("violations").insert(payload);

      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setModalOpen(false);
      await refreshViolations();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const supabase = createClient();
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("violations")
        .delete()
        .eq("id", deletingId);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successDelete, "success");
      setDeletingId(null);
      await refreshViolations();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.violations.title}
          subtitle={t.violations.subtitle}
          actions={
            <Button type="button" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              {t.violations.addViolation}
            </Button>
          }
        />

        {/* Filters */}
        <FilterBar
          hasActiveFilters={
            Boolean(search.trim()) ||
            severityFilter !== "all" ||
            statusFilter !== "all"
          }
          onReset={() => {
            setSearch("");
            setSeverityFilter("all");
            setStatusFilter("all");
          }}
          resetLabel={t.common.reset}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.members.searchPlaceholder}
                className="pl-10"
              />
            </div>
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">
                {t.violations.severity}: {t.common.all}
              </option>
              <option value="low">{t.violations.sevLow}</option>
              <option value="medium">{t.violations.sevMedium}</option>
              <option value="high">{t.violations.sevHigh}</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">
                {t.common.status}: {t.common.all}
              </option>
              <option value="pending">{t.violations.statusPending}</option>
              <option value="resolved">{t.violations.statusResolved}</option>
              <option value="appealed">{t.violations.statusAppealed}</option>
            </Select>
          </div>
        </FilterBar>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="h-6 w-6" />}
              title={t.common.noData}
              action={
                <Button type="button" size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4" />
                  {t.violations.addViolation}
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{t.common.dateTime}</th>
                    <th className="px-4 py-3">{t.common.member}</th>
                    <th className="px-4 py-3">{t.violations.violationType}</th>
                    <th className="px-4 py-3">{t.violations.severity}</th>
                    <th className="px-4 py-3 hidden md:table-cell">
                      {t.violations.penalty}
                    </th>
                    <th className="px-4 py-3">{t.common.status}</th>
                    <th className="px-4 py-3 text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(v.occurred_at, lang)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {v.member?.full_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {v.member?.student_code} •{" "}
                          {v.member?.room
                            ? `${v.member.room.building?.code ?? ""}-${v.member.room.room_number}`
                            : t.members.unassigned}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">
                          {typeLabel(v.violation_type)}
                        </p>
                        {v.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {v.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            v.severity === "high"
                              ? "rose"
                              : v.severity === "medium"
                              ? "amber"
                              : "slate"
                          }
                        >
                          {v.severity === "high"
                            ? t.violations.sevHigh
                            : v.severity === "medium"
                            ? t.violations.sevMedium
                            : t.violations.sevLow}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-700">
                        {v.penalty || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            v.status === "resolved"
                              ? "emerald"
                              : v.status === "appealed"
                              ? "purple"
                              : "amber"
                          }
                        >
                          {v.status === "resolved"
                            ? t.violations.statusResolved
                            : v.status === "appealed"
                            ? t.violations.statusAppealed
                            : t.violations.statusPending}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {v.evidence_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewUrl(v.evidence_url)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-700"
                              title={t.violations.evidence}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(v)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(v.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t.violations.editViolation : t.violations.addViolation}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.member} *
              </label>
              <select
                required
                value={vMemberId}
                onChange={(e) => setVMemberId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.student_code} — {m.full_name} (
                    {m.room?.room_number ?? t.members.unassigned})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.violations.violationType}
              </label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {VIOLATION_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {typeLabel(vt)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.violations.severity}
              </label>
              <select
                value={vSeverity}
                onChange={(e) =>
                  setVSeverity(e.target.value as ViolationSeverity)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="low">{t.violations.sevLow}</option>
                <option value="medium">{t.violations.sevMedium}</option>
                <option value="high">{t.violations.sevHigh}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.dateTime}
              </label>
              <input
                type="datetime-local"
                value={vOccurredAt}
                onChange={(e) => setVOccurredAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.status}
              </label>
              <select
                value={vStatus}
                onChange={(e) => setVStatus(e.target.value as ViolationStatus)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="pending">{t.violations.statusPending}</option>
                <option value="resolved">{t.violations.statusResolved}</option>
                <option value="appealed">{t.violations.statusAppealed}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.violations.description}
              </label>
              <textarea
                rows={2}
                value={vDescription}
                onChange={(e) => setVDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.violations.penalty}
              </label>
              <input
                type="text"
                value={vPenalty}
                onChange={(e) => setVPenalty(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <ImageUpload
                value={vEvidenceUrl}
                onChange={setVEvidenceUrl}
                folder="evidence"
                label={t.violations.evidence}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <ShieldAlert className="h-4 w-4" />
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Evidence Image Preview Modal */}
      <Modal
        open={Boolean(previewUrl)}
        onClose={() => setPreviewUrl(null)}
        title={t.violations.evidence}
        maxWidth="md"
      >
        {previewUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Violation evidence"
              className="max-h-[70vh] rounded-xl object-contain"
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppShell>
  );
}
