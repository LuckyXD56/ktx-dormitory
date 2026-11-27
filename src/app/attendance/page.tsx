"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Search,
  Trash2,
  UserX,
} from "lucide-react";
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
import { CardGridSkeleton } from "@/components/ui/TableSkeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { listAttendanceLogs, listBuildings, listMembers } from "@/services";
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
  AttendanceLog,
  AttendanceLogType,
  Building,
  Member,
} from "@/types/database";

export default function AttendancePage() {
  const { t, lang } = useI18n();
  const { user, isAdminOrAbove } = useAuth();
  const { showToast } = useToast();

  const initialAtt = getCached<{
    members: Member[];
    buildings: Building[];
    logs: AttendanceLog[];
  }>("attendance_page");

  const [members, setMembers] = useState<Member[]>(initialAtt?.members ?? []);
  const [buildings, setBuildings] = useState<Building[]>(
    initialAtt?.buildings ?? []
  );
  const [logs, setLogs] = useState<AttendanceLog[]>(initialAtt?.logs ?? []);
  const [loading, setLoading] = useState(!initialAtt);

  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [submittingMemberId, setSubmittingMemberId] = useState<string | null>(
    null
  );
  const [batchCheckingIn, setBatchCheckingIn] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  // Manual modal
  const [manualOpen, setManualOpen] = useState(false);
  const [mMemberId, setMMemberId] = useState("");
  const [mType, setMType] = useState<AttendanceLogType>("check_in");
  const [mDateTime, setMDateTime] = useState("");
  const [mNotes, setMNotes] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("attendance_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("attendance_page")) setLoading(true);
    try {
      const [mData, bData, lData] = await Promise.all([
        listMembers({ statuses: ["active"], orderBy: "full_name", ascending: true }),
        listBuildings(),
        listAttendanceLogs(300),
      ]);
      const payload = {
        members: mData,
        buildings: bData,
        logs: lData,
      };
      setMembers(payload.members);
      setBuildings(payload.buildings);
      setLogs(payload.logs);
      setCached("attendance_page", payload);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadData(true);
    });
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
      const saved = window.sessionStorage.getItem("dorm_att_filters");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          building?: string;
          type?: string;
        };
        if (parsed.building) setBuildingFilter(parsed.building);
        if (parsed.type) setTypeFilter(parsed.type);
      }
    } catch {
      // Ignore storage errors
    } finally {
      setFiltersReady(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersReady || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        "dorm_att_filters",
        JSON.stringify({ building: buildingFilter, type: typeFilter })
      );
    } catch {
      // Ignore storage errors
    }
  }, [filtersReady, buildingFilter, typeFilter]);

  const latestByMember = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    logs.forEach((log) => {
      if (!map.has(log.member_id)) map.set(log.member_id, log);
    });
    return map;
  }, [logs]);

  const notReturnedMembers = useMemo(() => {
    return members.filter((m) => {
      const latest = latestByMember.get(m.id);
      return (
        latest &&
        (latest.log_type === "check_out" ||
          latest.log_type === "absent" ||
          latest.log_type === "late")
      );
    });
  }, [members, latestByMember]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const match =
          m.full_name.toLowerCase().includes(q) ||
          m.student_code.toLowerCase().includes(q) ||
          (m.room?.room_number ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (buildingFilter !== "all" && m.room?.building_id !== buildingFilter) {
        return false;
      }
      return true;
    });
  }, [members, search, buildingFilter]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (typeFilter !== "all" && l.log_type !== typeFilter) return false;
      if (
        buildingFilter !== "all" &&
        l.member?.room?.building_id !== buildingFilter
      ) {
        return false;
      }
      if (q) {
        const match =
          (l.member?.full_name ?? "").toLowerCase().includes(q) ||
          (l.member?.student_code ?? "").toLowerCase().includes(q) ||
          (l.member?.room?.room_number ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [logs, typeFilter, buildingFilter, search]);

  const quickRecord = async (memberId: string, logType: AttendanceLogType) => {
    const supabase = createClient();
    if (!supabase || !user) return;
    setSubmittingMemberId(memberId);
    const targetMember = members.find((m) => m.id === memberId) ?? null;
    const optimisticId = `opt-${Date.now()}`;
    const optimisticLog: AttendanceLog = {
      id: optimisticId,
      member_id: memberId,
      log_type: logType,
      recorded_at: new Date().toISOString(),
      is_late: logType === "late" || logType === "absent",
      notes: "",
      recorded_by: user.id,
      created_at: new Date().toISOString(),
      member: targetMember,
    };
    setLogs((prev) => [optimisticLog, ...prev]);
    try {
      const { error } = await supabase.from("attendance_logs").insert({
        member_id: memberId,
        log_type: logType,
        recorded_at: optimisticLog.recorded_at,
        is_late: optimisticLog.is_late,
        notes: "",
        recorded_by: user.id,
      });
      if (error) {
        showToast(error.message, "error");
        setLogs((prev) => prev.filter((l) => l.id !== optimisticId));
        return;
      }
      showToast(t.common.successSave, "success");
      invalidateCache("attendance_page");
      invalidateCache("dashboard_page");
      emitAlertsRefresh();
      await loadData(true);
    } finally {
      setSubmittingMemberId(null);
    }
  };

  const openManualModal = () => {
    setMMemberId(members[0]?.id ?? "");
    setMType("check_in");
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setMDateTime(localIso);
    setMNotes("");
    setManualOpen(true);
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase || !user) return;
    setSavingManual(true);
    try {
      const { error } = await supabase.from("attendance_logs").insert({
        member_id: mMemberId,
        log_type: mType,
        recorded_at: mDateTime
          ? new Date(mDateTime).toISOString()
          : new Date().toISOString(),
        is_late: mType === "late" || mType === "absent",
        notes: mNotes.trim(),
        recorded_by: user.id,
      });
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setManualOpen(false);
      invalidateCache("attendance_page");
      invalidateCache("dashboard_page");
      emitAlertsRefresh();
      await loadData(true);
    } finally {
      setSavingManual(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!deletingId) return;
    const supabase = createClient();
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("attendance_logs")
        .delete()
        .eq("id", deletingId);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successDelete, "success");
      setDeletingId(null);
      invalidateCache("attendance_page");
      invalidateCache("dashboard_page");
      emitAlertsRefresh();
      await loadData(true);
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchCheckInAll = async () => {
    setBatchConfirmOpen(false);
    if (notReturnedMembers.length === 0) return;
    const supabase = createClient();
    if (!supabase || !user) return;
    setBatchCheckingIn(true);
    try {
      const now = new Date().toISOString();
      const rows = notReturnedMembers.map((m) => ({
        member_id: m.id,
        log_type: "check_in" as AttendanceLogType,
        recorded_at: now,
        is_late: false,
        notes: lang === "vi" ? "Điểm danh hàng loạt" : "เช็กชื่อเข้าหอแบบกลุ่ม",
        recorded_by: user.id,
      }));
      const { error } = await supabase.from("attendance_logs").insert(rows);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      invalidateCache("attendance_page");
      invalidateCache("dashboard_page");
      emitAlertsRefresh();
      await loadData(true);
    } finally {
      setBatchCheckingIn(false);
    }
  };

  const renderTypeBadge = (logType: AttendanceLogType) => {
    switch (logType) {
      case "check_in":
        return <Badge variant="emerald">{t.attendance.checkIn}</Badge>;
      case "check_out":
        return <Badge variant="sky">{t.attendance.checkOut}</Badge>;
      case "late":
        return <Badge variant="amber">{t.attendance.late}</Badge>;
      case "absent":
        return <Badge variant="rose">{t.attendance.absent}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t.attendance.title}
          subtitle={t.attendance.subtitle}
          actions={
            <Button type="button" onClick={openManualModal}>
              <Plus className="h-4 w-4" />
              {t.attendance.recordManual}
            </Button>
          }
        />

        {/* Who Hasn't Returned Alert Box */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <h2 className="text-sm font-bold text-rose-950">
                {t.attendance.notReturnedTitle} ({notReturnedMembers.length})
              </h2>
            </div>
            {notReturnedMembers.length > 1 && (
              <Button
                type="button"
                size="sm"
                disabled={batchCheckingIn}
                onClick={() => setBatchConfirmOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {batchCheckingIn ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {lang === "vi"
                  ? `Điểm danh về hết (${notReturnedMembers.length})`
                  : `เช็กเข้าหอทั้งหมด (${notReturnedMembers.length})`}
              </Button>
            )}
          </div>

          {notReturnedMembers.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4.5 w-4.5" />
              <span>{t.attendance.allReturned}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {notReturnedMembers.map((m) => {
                const latest = latestByMember.get(m.id)!;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white border border-rose-200 p-3 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {m.full_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.room
                          ? `${m.room.building?.code ?? ""}-${m.room.room_number}`
                          : t.members.unassigned}{" "}
                        • {formatDateTime(latest.recorded_at, lang)}
                      </p>
                      <div className="mt-1">{renderTypeBadge(latest.log_type)}</div>
                    </div>
                    <button
                      type="button"
                      disabled={submittingMemberId === m.id}
                      onClick={() => quickRecord(m.id, "check_in")}
                      className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {t.attendance.checkIn}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <FilterBar
          hasActiveFilters={
            Boolean(search.trim()) ||
            buildingFilter !== "all" ||
            typeFilter !== "all"
          }
          onReset={() => {
            setSearch("");
            setBuildingFilter("all");
            setTypeFilter("all");
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
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
            >
              <option value="all">
                {t.common.building}: {t.common.all}
              </option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">
                {t.common.status}: {t.common.all}
              </option>
              <option value="check_in">{t.attendance.checkIn}</option>
              <option value="check_out">{t.attendance.checkOut}</option>
              <option value="late">{t.attendance.late}</option>
              <option value="absent">{t.attendance.absent}</option>
            </Select>
          </div>
        </FilterBar>

        {/* Quick Roll-Call Grid */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            {t.attendance.quickRollCall}
          </h2>
          {loading ? (
            <CardGridSkeleton
              count={4}
              columnsClass="grid-cols-1 md:grid-cols-2"
            />
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-6 w-6" />}
              title={t.common.noData}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMembers.map((m) => {
                const latest = latestByMember.get(m.id);
                const busy = submittingMemberId === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-navy-200"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {m.full_name}
                        </p>
                        {latest ? (
                          renderTypeBadge(latest.log_type)
                        ) : (
                          <Badge variant="slate">{t.attendance.noLogYet}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {m.student_code} •{" "}
                        {m.room
                          ? `${m.room.building?.code ?? ""}-${m.room.room_number}`
                          : t.members.unassigned}
                        {latest
                          ? ` • ${formatDateTime(latest.recorded_at, lang)}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => quickRecord(m.id, "check_in")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        {t.attendance.checkIn}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => quickRecord(m.id, "check_out")}
                        className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        {t.attendance.checkOut}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => quickRecord(m.id, "late")}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {t.attendance.late}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => quickRecord(m.id, "absent")}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        {t.attendance.absent}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              {t.attendance.historyTitle}
            </h2>
          </div>
          {filteredLogs.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              {t.common.noData}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{t.common.dateTime}</th>
                    <th className="px-4 py-3">{t.common.member}</th>
                    <th className="px-4 py-3">{t.common.room}</th>
                    <th className="px-4 py-3">{t.common.status}</th>
                    <th className="px-4 py-3 hidden md:table-cell">
                      {t.attendance.recordedBy}
                    </th>
                    <th className="px-4 py-3 hidden sm:table-cell">
                      {t.common.notes}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {formatDateTime(l.recorded_at, lang)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {l.member?.full_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {l.member?.student_code}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {l.member?.room
                          ? `${l.member.room.building?.code ?? ""}-${l.member.room.room_number}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">{renderTypeBadge(l.log_type)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                        {l.recorder?.full_name ?? "-"}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">
                        {l.notes || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setDeletingId(l.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Manual Record Modal */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title={t.attendance.recordManual}
        maxWidth="md"
      >
        <form onSubmit={handleSaveManual} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.common.member} *
            </label>
            <select
              required
              value={mMemberId}
              onChange={(e) => setMMemberId(e.target.value)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.status}
              </label>
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value as AttendanceLogType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="check_in">{t.attendance.checkIn}</option>
                <option value="check_out">{t.attendance.checkOut}</option>
                <option value="late">{t.attendance.late}</option>
                <option value="absent">{t.attendance.absent}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.dateTime}
              </label>
              <input
                type="datetime-local"
                value={mDateTime}
                onChange={(e) => setMDateTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.common.notes}
            </label>
            <textarea
              rows={2}
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setManualOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingManual}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {savingManual ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteLog}
        loading={deleting}
      />

      <ConfirmDialog
        open={batchConfirmOpen}
        onClose={() => setBatchConfirmOpen(false)}
        onConfirm={handleBatchCheckInAll}
        loading={batchCheckingIn}
        tone="primary"
        title={t.attendance.quickRollCall}
        description={
          lang === "vi"
            ? `Xác nhận điểm danh về KTX cho tất cả ${notReturnedMembers.length} thành viên chưa về?`
            : `ยืนยันเช็กชื่อกลับเข้าหอพร้อมกันทั้งหมด ${notReturnedMembers.length} คน?`
        }
      />
    </AppShell>
  );
}
