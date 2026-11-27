"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BedDouble,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StudentRoomPortal } from "@/components/student/StudentRoomPortal";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { fetchDashboardSnapshot } from "@/services";
import {
  emitAlertsRefresh,
  emitDormSync,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { pickLang, useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency, formatDateTime, getInitials } from "@/lib/utils";
import type {
  Announcement,
  AttendanceLog,
  Building,
  Member,
  Payment,
  Room,
  Violation,
} from "@/types/database";

const DashboardCharts = dynamic(
  () =>
    import("@/components/dashboard/DashboardCharts").then(
      (mod) => mod.DashboardCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    ),
  }
);

type QuickTab = "unpaid" | "not_returned" | "violations" | "quick_find";

export default function DashboardPage() {
  const { t, lang } = useI18n();
  const { user, loading: authLoading, isStudent } = useAuth();
  const { showToast } = useToast();

  const initialDash = getCached<{
    members: Member[];
    buildings: Building[];
    rooms: Room[];
    payments: Payment[];
    attendanceLogs: AttendanceLog[];
    violations: Violation[];
    announcements: Announcement[];
  }>("dashboard_page");

  const [loading, setLoading] = useState(!initialDash);
  const [members, setMembers] = useState<Member[]>(initialDash?.members ?? []);
  const [buildings, setBuildings] = useState<Building[]>(
    initialDash?.buildings ?? []
  );
  const [rooms, setRooms] = useState<Room[]>(initialDash?.rooms ?? []);
  const [payments, setPayments] = useState<Payment[]>(
    initialDash?.payments ?? []
  );
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(
    initialDash?.attendanceLogs ?? []
  );
  const [violations, setViolations] = useState<Violation[]>(
    initialDash?.violations ?? []
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>(
    initialDash?.announcements ?? []
  );

  const [quickTab, setQuickTab] = useState<QuickTab>("unpaid");
  const [quickQuery, setQuickQuery] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    if (!force && isCacheFresh("dashboard_page", 15_000)) {
      setLoading(false);
      return;
    }

    if (!initialDash) setLoading(true);
    try {
      const snap = await fetchDashboardSnapshot();
      const payload = {
        members: snap.members,
        buildings: snap.buildings,
        rooms: snap.rooms,
        payments: snap.payments,
        attendanceLogs: snap.attendance,
        violations: snap.violations,
        announcements: snap.announcements.slice(0, 4),
      };
      setMembers(payload.members);
      setBuildings(payload.buildings);
      setRooms(payload.rooms);
      setPayments(payload.payments);
      setAttendanceLogs(payload.attendanceLogs);
      setViolations(payload.violations);
      setAnnouncements(payload.announcements);
      setCached("dashboard_page", payload);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authLoading && !isStudent) {
      loadDashboard(false);
    }
  }, [authLoading, isStudent, loadDashboard]);

  useEffect(() => {
    if (isStudent) return;
    return subscribeDormSync(() => {
      loadDashboard(true);
    });
  }, [isStudent, loadDashboard]);

  const notReturnedList = useMemo(() => {
    const latestMap = new Map<string, AttendanceLog>();
    for (const log of attendanceLogs) {
      if (!latestMap.has(log.member_id)) {
        latestMap.set(log.member_id, log);
      }
    }
    return members
      .filter((m) => m.status === "active")
      .map((m) => ({ member: m, latestLog: latestMap.get(m.id) }))
      .filter(
        ({ latestLog }) =>
          latestLog &&
          (latestLog.log_type === "check_out" ||
            latestLog.log_type === "absent" ||
            latestLog.log_type === "late")
      );
  }, [members, attendanceLogs]);

  const unpaidPayments = useMemo(
    () => payments.filter((p) => p.status !== "paid"),
    [payments]
  );

  const unpaidMemberCount = useMemo(
    () => new Set(unpaidPayments.map((p) => p.member_id)).size,
    [unpaidPayments]
  );

  const totalUnpaidAmount = useMemo(
    () =>
      unpaidPayments.reduce(
        (sum, p) => sum + Math.max(0, Number(p.amount) - Number(p.paid_amount)),
        0
      ),
    [unpaidPayments]
  );

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );

  const availableRoomsCount = useMemo(
    () => rooms.filter((r) => r.status === "available").length,
    [rooms]
  );

  const pendingViolationsCount = useMemo(
    () => violations.filter((v) => v.status === "pending").length,
    [violations]
  );

  const monthlyRevenueData = useMemo(() => {
    const map = new Map<
      string,
      { month: string; billed: number; collected: number }
    >();
    payments.forEach((p) => {
      const key = p.billing_month;
      const cur = map.get(key) ?? { month: key, billed: 0, collected: 0 };
      cur.billed += Number(p.amount || 0);
      cur.collected += Number(p.paid_amount || 0);
      map.set(key, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [payments]);

  const buildingStats = useMemo(() => {
    return buildings.map((b) => {
      const bRooms = rooms.filter((r) => r.building_id === b.id);
      const totalBeds = bRooms.reduce((sum, r) => sum + r.capacity, 0);
      const bRoomIds = new Set(bRooms.map((r) => r.id));
      const occupied = members.filter(
        (m) =>
          m.room_id &&
          bRoomIds.has(m.room_id) &&
          (m.status === "active" || m.status === "on_leave")
      ).length;
      const free = Math.max(0, totalBeds - occupied);
      return {
        building: b,
        name: b.code || b.name,
        roomCount: bRooms.length,
        totalBeds,
        occupied,
        free,
      };
    });
  }, [buildings, rooms, members]);

  const buildingOccupancyData = useMemo(
    () =>
      buildingStats.map((s) => ({
        name: s.name,
        occupied: s.occupied,
        free: s.free,
      })),
    [buildingStats]
  );

  const quickFoundMembers = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return activeMembers.slice(0, 8);
    return members
      .filter(
        (m) =>
          m.full_name.toLowerCase().includes(q) ||
          m.student_code.toLowerCase().includes(q) ||
          (m.room?.room_number ?? "").toLowerCase().includes(q) ||
          m.phone.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [quickQuery, activeMembers, members]);

  const handleQuickCheckIn = async (memberId: string) => {
    const supabase = createClient();
    if (!supabase || !user) return;
    setCheckingInId(memberId);
    try {
      const { error } = await supabase.from("attendance_logs").insert({
        member_id: memberId,
        log_type: "check_in",
        recorded_at: new Date().toISOString(),
        is_late: false,
        notes: "Quick check-in from Dashboard",
        recorded_by: user.id,
      });
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      invalidateCache("dashboard_page");
      invalidateCache("attendance_page");
      emitAlertsRefresh();
      emitDormSync("attendance_logs");
      await loadDashboard(true);
    } finally {
      setCheckingInId(null);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      invalidateCache("dashboard_page");
      emitAlertsRefresh();
      await loadDashboard(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (authLoading && !user) {
    return (
      <AppShell>
        <div className="space-y-5">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </AppShell>
    );
  }

  if (isStudent) {
    return (
      <AppShell>
        <StudentRoomPortal />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Page Heading */}
        <PageHeader
          title={t.dashboard.title}
          subtitle={t.dashboard.subtitle}
          actions={
            <>
              <button
                type="button"
                disabled={refreshing}
                onClick={handleManualRefresh}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                aria-label="Refresh Dashboard"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {pickLang(lang, {
                    th: "รีเฟรช",
                    vi: "Làm mới",
                    en: "Refresh",
                    zh: "刷新",
                    lo: "ໂຫຼດໃໝ່",
                  })}
                </span>
              </button>
              <Link
                href="/glassy-demo"
                prefetch
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t.nav.glassyView}
              </Link>
              <Link
                href="/rooms"
                prefetch
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Building2 className="h-4 w-4 text-navy-600" />
                {t.nav.rooms}
              </Link>
              <Link
                href="/attendance"
                prefetch
                className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-navy-700 transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                {t.attendance.quickRollCall}
              </Link>
            </>
          }
        />

        {loading ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-56 rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            {/* 6 KPI Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              <Link
                href="/members"
                prefetch
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs border-t-4 border-t-navy-600 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {t.dashboard.totalMembers}
                  </span>
                  <div className="rounded-xl bg-navy-50 p-2 text-navy-600">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {members.length}
                </p>
              </Link>

              <Link
                href="/members"
                prefetch
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs border-t-4 border-t-emerald-500 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {t.dashboard.activeResidents}
                  </span>
                  <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                    <UserCheck className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-700">
                  {activeMembers.length}
                </p>
              </Link>

              <Link
                href="/rooms"
                prefetch
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs border-t-4 border-t-slate-500 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {t.dashboard.totalRooms}
                  </span>
                  <div className="rounded-xl bg-slate-100 p-2 text-slate-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {rooms.length}
                </p>
              </Link>

              <Link
                href="/rooms"
                prefetch
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs border-t-4 border-t-sky-500 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {t.dashboard.availableRooms}
                  </span>
                  <div className="rounded-xl bg-sky-50 p-2 text-sky-600">
                    <BedDouble className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-sky-700">
                  {availableRoomsCount}
                </p>
              </Link>

              <Link
                href="/fees"
                prefetch
                className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-xs border-t-4 border-t-amber-500 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-800">
                    {t.dashboard.unpaidMembers}
                  </span>
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                    <CreditCard className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {unpaidMemberCount}
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5 truncate">
                  {formatCurrency(totalUnpaidAmount, lang)}
                </p>
              </Link>

              <Link
                href="/attendance"
                prefetch
                className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-xs border-t-4 border-t-rose-500 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-rose-800">
                    {t.dashboard.lateOrViolations}
                  </span>
                  <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-bold text-rose-900">
                  {notReturnedList.length} / {pendingViolationsCount}
                </p>
              </Link>
            </div>

            {/* Buildings Summary Strip */}
            {buildingStats.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {buildingStats.map((item) => {
                  const pct =
                    item.totalBeds > 0
                      ? Math.round((item.occupied / item.totalBeds) * 100)
                      : 0;
                  if (!item) return null;
                  return (
                    <Link
                      key={item.building.id}
                      href={`/rooms?building=${encodeURIComponent(item.building.code)}`}
                      prefetch
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-navy-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-navy-600">
                            {item.building.code} • {item.building.total_floors}{" "}
                            {t.rooms.floor}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">
                            {item.building.name}
                          </h3>
                        </div>
                        <Badge variant="navy">
                          {item.roomCount} {t.common.room}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>
                            {t.dashboard.occupiedBeds}:{" "}
                            <strong className="text-slate-800">
                              {item.occupied}/{item.totalBeds}
                            </strong>
                          </span>
                          <span className="font-semibold text-emerald-700">
                            {t.rooms.bedsAvailable.replace(
                              "{n}",
                              String(item.free)
                            )}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-navy-600 to-blue-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Mobile-First Quick Control Center */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="border-b border-slate-100 bg-gradient-to-r from-navy-950 to-[#14255c] px-5 py-3.5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-300" />
                  <h2 className="text-sm font-semibold">
                    {t.dashboard.quickControlTitle}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      {
                        key: "unpaid",
                        label: `${t.dashboard.tabUnpaid} (${unpaidPayments.length})`,
                      },
                      {
                        key: "not_returned",
                        label: `${t.dashboard.tabNotReturned} (${notReturnedList.length})`,
                      },
                      {
                        key: "violations",
                        label: `${t.dashboard.tabViolations} (${violations.length})`,
                      },
                      {
                        key: "quick_find",
                        label: t.dashboard.tabQuickFind,
                      },
                    ] as { key: QuickTab; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setQuickTab(tab.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        quickTab === tab.key
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white/10 text-slate-200 hover:bg-white/20"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {quickTab === "unpaid" && (
                  <div className="space-y-2.5">
                    {unpaidPayments.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 py-4">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t.common.noData}</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {unpaidPayments.slice(0, 6).map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-navy-200"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {p.member?.full_name ?? "-"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {p.member?.student_code} •{" "}
                                {p.member?.room
                                  ? `${p.member.room.building?.code ?? ""}-${p.member.room.room_number}`
                                  : t.members.unassigned}{" "}
                                • {p.billing_month}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-rose-600">
                                {formatCurrency(
                                  Number(p.amount) - Number(p.paid_amount),
                                  lang
                                )}
                              </p>
                              <Link
                                href="/fees"
                                prefetch
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-navy-600 hover:underline"
                              >
                                {t.fees.recordPayment}
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {quickTab === "not_returned" && (
                  <div className="space-y-2.5">
                    {notReturnedList.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 py-4">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t.attendance.allReturned}</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {notReturnedList.map(({ member, latestLog }) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/40 p-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {member.full_name}
                                </p>
                                <Badge
                                  variant={
                                    latestLog?.log_type === "late"
                                      ? "amber"
                                      : "rose"
                                  }
                                >
                                  {latestLog?.log_type === "late"
                                    ? t.attendance.late
                                    : latestLog?.log_type === "absent"
                                    ? t.attendance.absent
                                    : t.attendance.checkOut}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {member.room
                                  ? `${member.room.building?.code ?? ""}-${member.room.room_number}`
                                  : t.members.unassigned}{" "}
                                • {formatDateTime(latestLog?.recorded_at, lang)}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={checkingInId === member.id}
                              onClick={() => handleQuickCheckIn(member.id)}
                              className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {checkingInId === member.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                t.attendance.checkIn
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {quickTab === "violations" && (
                  <div className="space-y-2.5">
                    {violations.length === 0 ? (
                      <p className="text-sm text-slate-500 py-4">
                        {t.common.noData}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {violations.slice(0, 6).map((v) => (
                          <div
                            key={v.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {v.member?.full_name ?? "-"}
                                </p>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                                {v.description || v.violation_type}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {formatDateTime(v.occurred_at, lang)}
                              </p>
                            </div>
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
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {quickTab === "quick_find" && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={quickQuery}
                        onChange={(e) => setQuickQuery(e.target.value)}
                        placeholder={t.members.searchPlaceholder}
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {quickFoundMembers.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-800 overflow-hidden">
                            {m.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.avatar_url}
                                alt={m.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(m.full_name)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {m.full_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {m.student_code} •{" "}
                              {m.room
                                ? `${m.room.building?.name ?? m.room.building?.code ?? ""} / ${t.rooms.floor} ${m.room.floor} / ${m.room.room_number}`
                                : t.members.unassigned}
                            </p>
                          </div>
                          <Badge
                            variant={
                              m.status === "active"
                                ? "emerald"
                                : m.status === "on_leave"
                                ? "amber"
                                : "slate"
                            }
                          >
                            {m.status === "active"
                              ? t.members.statusActive
                              : m.status === "on_leave"
                              ? t.members.statusOnLeave
                              : m.status === "checked_out"
                              ? t.members.statusCheckedOut
                              : t.members.statusSuspended}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lazy-loaded Charts */}
            <DashboardCharts
              monthlyRevenueData={monthlyRevenueData}
              buildingOccupancyData={buildingOccupancyData}
            />

            {/* Announcements Row */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-navy-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t.dashboard.latestAnnouncements}
                  </h3>
                </div>
                <Link
                  href="/announcements"
                  prefetch
                  className="text-xs font-semibold text-navy-600 hover:underline"
                >
                  {t.common.viewDetails} →
                </Link>
              </div>
              {announcements.length === 0 ? (
                <p className="text-sm text-slate-400">{t.common.noData}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {a.title}
                        </p>
                        {a.is_pinned && (
                          <Badge variant="navy">{t.announcements.pinned}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {a.content}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {formatDateTime(a.published_at, lang)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
