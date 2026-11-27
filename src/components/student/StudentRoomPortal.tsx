"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Building2,
  Calendar,
  ClipboardCheck,
  CreditCard,
  Globe2,
  Lock,
  Megaphone,
  Pin,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatDateTime, getInitials } from "@/lib/utils";
import type {
  Announcement,
  AttendanceLog,
  Member,
  Payment,
  Room,
} from "@/types/database";

export function StudentRoomPortal() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [roommates, setRoommates] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const loadRoomData = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !profile?.room_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const roomId = profile.room_id;
      const [roomRes, membersRes, payRes, attRes, annRes] = await Promise.all([
        supabase
          .from("rooms")
          .select("*, building:buildings(*)")
          .eq("id", roomId)
          .maybeSingle(),
        supabase
          .from("members")
          .select("*")
          .eq("room_id", roomId)
          .order("full_name", { ascending: true }),
        supabase
          .from("payments")
          .select("*, member:members(id, full_name, student_code)")
          .order("billing_month", { ascending: false })
          .limit(30),
        supabase
          .from("attendance_logs")
          .select("*, member:members(id, full_name, student_code)")
          .order("recorded_at", { ascending: false })
          .limit(40),
        supabase
          .from("announcements")
          .select("*, building:buildings(name), room:rooms(room_number)")
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(6),
      ]);

      if (roomRes.error) throw roomRes.error;
      if (membersRes.error) throw membersRes.error;

      setRoom((roomRes.data as Room | null) ?? null);
      setRoommates((membersRes.data as Member[]) ?? []);
      setPayments((payRes.data as Payment[]) ?? []);
      setAttendance((attRes.data as AttendanceLog[]) ?? []);
      setAnnouncements((annRes.data as Announcement[]) ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.room_id]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  const activeCount = useMemo(
    () =>
      roommates.filter((m) => m.status === "active" || m.status === "on_leave")
        .length,
    [roommates]
  );

  const latestAttendanceByMember = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    for (const log of attendance) {
      if (!map.has(log.member_id)) {
        map.set(log.member_id, log);
      }
    }
    return map;
  }, [attendance]);

  const statusBadge = (status: Member["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="emerald">{t.members.statusActive}</Badge>;
      case "on_leave":
        return <Badge variant="amber">{t.members.statusOnLeave}</Badge>;
      case "checked_out":
        return <Badge variant="slate">{t.members.statusCheckedOut}</Badge>;
      case "suspended":
        return <Badge variant="rose">{t.members.statusSuspended}</Badge>;
    }
  };

  const feeTypeLabel = (feeType: Payment["fee_type"]) => {
    switch (feeType) {
      case "room_fee":
        return t.fees.typeRoom;
      case "water":
        return t.fees.typeWater;
      case "electricity":
        return t.fees.typeElectricity;
      case "fine":
        return t.fees.typeFine;
      default:
        return t.fees.typeOther;
    }
  };

  const attendanceBadge = (logType: AttendanceLog["log_type"]) => {
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

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!profile?.room_id || !room) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t.studentPortal.title}
          subtitle={t.studentPortal.subtitle}
          icon={<BedDouble className="h-5 w-5" />}
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title={t.studentPortal.noRoomAssigned}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.studentPortal.title}
        subtitle={t.studentPortal.subtitle}
        icon={<BedDouble className="h-5 w-5" />}
        badge={
          <Badge variant="navy" className="gap-1">
            <Lock className="h-3 w-3" />
            {t.studentPortal.readOnlyBadge}
          </Badge>
        }
      />

      {/* Room Summary Card */}
      <div className="rounded-2xl border border-navy-200/80 bg-gradient-to-br from-navy-800 via-navy-900 to-slate-900 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Building2 className="h-3.5 w-3.5" />
              <span>{room.building?.name ?? room.building?.code ?? t.common.building}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {room.room_number}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/80">
              {t.rooms.floor} {room.floor} · {profile.email}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-blue-100/75">{t.rooms.occupants}</p>
              <p className="text-lg sm:text-xl font-bold mt-0.5 tabular-nums">
                {activeCount} / {room.capacity}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-blue-100/75">{t.rooms.monthlyFee}</p>
              <p className="text-sm sm:text-base font-bold mt-1 tabular-nums">
                {formatCurrency(Number(room.monthly_fee), lang)}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] text-blue-100/75">{t.common.status}</p>
              <p className="text-sm sm:text-base font-bold mt-1 text-emerald-300">
                {room.status === "full"
                  ? t.rooms.statusFull
                  : room.status === "maintenance"
                    ? t.rooms.statusMaintenance
                    : t.rooms.statusAvailable}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Roommates List (Strictly Scoped to This Room) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-50 text-navy-600">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {t.studentPortal.roommatesTitle} ({roommates.length})
              </h3>
              <p className="text-xs text-slate-500">
                {t.studentPortal.roommatesSubtitle}
              </p>
            </div>
          </div>
        </div>

        {roommates.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={t.rooms.emptyRoom}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {roommates.map((m, idx) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-800 text-xs font-bold">
                    {getInitials(m.full_name)}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 tabular-nums">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {m.full_name}
                      </p>
                      {statusBadge(m.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-700">
                        {m.student_code}
                      </span>
                      <span>
                        {m.gender === "female"
                          ? t.members.female
                          : m.gender === "male"
                            ? t.members.male
                            : t.members.other}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="h-3 w-3 text-slate-400" />
                        {m.country}
                        {m.province ? ` · ${m.province}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {formatDate(m.check_in_date, lang)}
                      </span>
                    </div>
                    {m.notes && (
                      <p className="text-xs text-slate-500 pt-0.5">{m.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Grid: Room Fees & Attendance + Announcements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Room Fees */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {t.studentPortal.feesTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.studentPortal.feesSubtitle}
              </p>
            </div>
          </div>

          {payments.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              {t.studentPortal.noFeesYet}
            </p>
          ) : (
            <div className="space-y-2.5">
              {payments.slice(0, 8).map((p) => {
                const remaining = Math.max(
                  0,
                  Number(p.amount) - Number(p.paid_amount)
                );
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {p.member?.full_name ?? room.room_number} ·{" "}
                        {feeTypeLabel(p.fee_type)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {t.fees.billingMonth}: {p.billing_month}
                        {p.due_date ? ` · ${t.fees.dueDate}: ${formatDate(p.due_date, lang)}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 tabular-nums">
                        {formatCurrency(
                          p.status === "paid" ? Number(p.amount) : remaining,
                          lang
                        )}
                      </p>
                      <Badge
                        variant={
                          p.status === "paid"
                            ? "emerald"
                            : p.status === "partial"
                              ? "amber"
                              : "rose"
                        }
                      >
                        {p.status === "paid"
                          ? t.fees.statusPaid
                          : p.status === "partial"
                            ? t.fees.statusPartial
                            : t.fees.statusUnpaid}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance & Announcements */}
        <div className="space-y-5">
          {/* Room Attendance */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {t.studentPortal.attendanceTitle}
              </h3>
            </div>

            {latestAttendanceByMember.size === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                {t.studentPortal.noAttendanceYet}
              </p>
            ) : (
              <div className="space-y-2">
                {roommates.map((m) => {
                  const log = latestAttendanceByMember.get(m.id);
                  if (!log) return null;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-slate-800 truncate">
                        {m.full_name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400">
                          {formatDateTime(log.recorded_at, lang)}
                        </span>
                        {attendanceBadge(log.log_type)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Relevant Announcements */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Megaphone className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t.studentPortal.announcementsTitle}
                </h3>
              </div>
              <Link
                href="/announcements"
                className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:underline"
              >
                {t.studentPortal.viewAllAnnouncements}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                {t.studentPortal.noAnnouncementsYet}
              </p>
            ) : (
              <div className="space-y-2.5">
                {announcements.slice(0, 4).map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-xl border px-3.5 py-2.5 ${
                      a.is_pinned
                        ? "border-navy-200 bg-navy-50/40"
                        : "border-slate-100 bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {a.is_pinned && (
                        <Pin className="h-3 w-3 text-navy-600 shrink-0" />
                      )}
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {a.title}
                      </p>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {a.content}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {formatDateTime(a.published_at, lang)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
