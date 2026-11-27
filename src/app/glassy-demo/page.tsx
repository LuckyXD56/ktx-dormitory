"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GlassyDashboard, {
  type DormGlassyData,
  type DormWorkItem,
} from "@/components/ui/glassy-dashboard";
import { createClient } from "@/lib/supabase/client";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { formatDateTime, generateReceiptNumber } from "@/lib/utils";
import type {
  Announcement,
  AttendanceLog,
  Building,
  Member,
  Payment,
  Room,
  Violation,
} from "@/types/database";

interface DashCache {
  members: Member[];
  buildings: Building[];
  rooms: Room[];
  payments: Payment[];
  attendanceLogs: AttendanceLog[];
  violations: Violation[];
  announcements: Announcement[];
}

export default function GlassyDormPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [dark, setDark] = useState(false);

  const initialDash = getCached<DashCache>("dashboard_page");
  const [raw, setRaw] = useState<DashCache>(
    initialDash ?? {
      members: [],
      buildings: [],
      rooms: [],
      payments: [],
      attendanceLogs: [],
      violations: [],
      announcements: [],
    }
  );

  useEffect(() => {
    const html = document.documentElement;
    const update = () => {
      try {
        const saved = window.localStorage.getItem("gd_theme");
        if (saved === "dark" || saved === "light") {
          setDark(saved === "dark");
          return;
        }
      } catch {
        // Ignore storage error
      }
      if (html.classList.contains("dark") || html.dataset.theme === "dark")
        setDark(true);
      else setDark(false);
    };
    const changes = new MutationObserver(update);
    changes.observe(html, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    update();
    return () => {
      changes.disconnect();
    };
  }, []);

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("dashboard_page", 15_000)) return;

    const [memRes, bldRes, roomRes, payRes, attRes, violRes, annRes] =
      await Promise.all([
        supabase
          .from("members")
          .select("*, room:rooms(*, building:buildings(*))")
          .order("created_at", { ascending: false }),
        supabase.from("buildings").select("*").order("code"),
        supabase
          .from("rooms")
          .select("*, building:buildings(*)")
          .order("room_number"),
        supabase
          .from("payments")
          .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
          .order("created_at", { ascending: false }),
        supabase
          .from("attendance_logs")
          .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
          .order("recorded_at", { ascending: false })
          .limit(200),
        supabase
          .from("violations")
          .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
          .order("occurred_at", { ascending: false })
          .limit(40),
        supabase
          .from("announcements")
          .select("*, building:buildings(*), room:rooms(*)")
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(10),
      ]);

    const next: DashCache = {
      members: (memRes.data as Member[]) ?? [],
      buildings: (bldRes.data as Building[]) ?? [],
      rooms: (roomRes.data as Room[]) ?? [],
      payments: (payRes.data as Payment[]) ?? [],
      attendanceLogs: (attRes.data as AttendanceLog[]) ?? [],
      violations: (violRes.data as Violation[]) ?? [],
      announcements: (annRes.data as Announcement[]) ?? [],
    };
    setRaw(next);
    setCached("dashboard_page", next);
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadData(true);
    });
  }, [loadData]);

  const dormData: DormGlassyData = useMemo(() => {
    const activeMembers = raw.members.filter((m) => m.status === "active");
    const totalBeds = raw.rooms.reduce((s, r) => s + r.capacity, 0);
    const occupiedBeds = raw.members.filter(
      (m) =>
        Boolean(m.room_id) &&
        (m.status === "active" || m.status === "on_leave")
    ).length;
    const availableRooms = raw.rooms.filter(
      (r) => r.status === "available"
    ).length;

    const totalCollected = raw.payments.reduce(
      (s, p) => s + Number(p.paid_amount || 0),
      0
    );
    const totalBilled = raw.payments.reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const totalOutstanding = Math.max(0, totalBilled - totalCollected);

    const roomFeeSum = raw.payments
      .filter((p) => p.fee_type === "room_fee")
      .reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const utilFeeSum = raw.payments
      .filter((p) => p.fee_type === "water" || p.fee_type === "electricity")
      .reduce((s, p) => s + Number(p.paid_amount || 0), 0);
    const otherFeeSum = raw.payments
      .filter((p) => p.fee_type === "fine" || p.fee_type === "other")
      .reduce((s, p) => s + Number(p.paid_amount || 0), 0);

    // Last 6 months revenue trend
    const monthMap = new Map<
      string,
      { label: string; collected: number; billed: number }
    >();
    raw.payments.forEach((p) => {
      const k = p.billing_month;
      const cur = monthMap.get(k) ?? { label: k, collected: 0, billed: 0 };
      cur.collected += Number(p.paid_amount || 0);
      cur.billed += Number(p.amount || 0);
      monthMap.set(k, cur);
    });
    const monthlySeries = Array.from(monthMap.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-7);

    // Last 7 days attendance counts
    const dayMap = new Map<
      string,
      { label: string; onTime: number; lateOrAbsent: number }
    >();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(lang === "vi" ? "vi-VN" : "th-TH", {
        weekday: "short",
      });
      dayMap.set(key, { label, onTime: 0, lateOrAbsent: 0 });
    }
    raw.attendanceLogs.forEach((log) => {
      const key = log.recorded_at.slice(0, 10);
      const bucket = dayMap.get(key);
      if (!bucket) return;
      if (log.log_type === "late" || log.log_type === "absent") {
        bucket.lateOrAbsent += 1;
      } else {
        bucket.onTime += 1;
      }
    });

    // Building breakdown
    const buildingBreakdown = raw.buildings.map((b) => {
      const bRooms = raw.rooms.filter((r) => r.building_id === b.id);
      const bRoomIds = new Set(bRooms.map((r) => r.id));
      const occ = raw.members.filter(
        (m) =>
          m.room_id &&
          bRoomIds.has(m.room_id) &&
          (m.status === "active" || m.status === "on_leave")
      ).length;
      const cap = bRooms.reduce((s, r) => s + r.capacity, 0);
      return {
        label: b.code || b.name,
        occupied: occ,
        capacity: cap,
      };
    });

    // Latest status per member
    const latestAttMap = new Map<string, AttendanceLog>();
    raw.attendanceLogs.forEach((l) => {
      if (!latestAttMap.has(l.member_id)) latestAttMap.set(l.member_id, l);
    });

    const unpaidList = raw.payments.filter((p) => p.status !== "paid");
    const notReturnedList = activeMembers.filter((m) => {
      const l = latestAttMap.get(m.id);
      return (
        l &&
        (l.log_type === "check_out" ||
          l.log_type === "late" ||
          l.log_type === "absent")
      );
    });
    const pendingViolations = raw.violations.filter(
      (v) => v.status === "pending"
    );

    const workItems: DormWorkItem[] = [
      ...unpaidList.slice(0, 10).map((p) => ({
        id: `pay:${p.id}`,
        entityId: p.id,
        kind: "payment" as const,
        name: p.member?.full_name ?? "-",
        description: `${p.billing_month} • ${new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "th-TH").format(Math.max(0, Number(p.amount) - Number(p.paid_amount)))} ${lang === "vi" ? "VND" : "₫"}`,
        tool: p.member?.room?.room_number ?? "-",
        owner: p.member?.student_code ?? "-",
        status: "Unpaid" as const,
        timestamp: p.billing_month,
      })),
      ...notReturnedList.slice(0, 10).map((m) => {
        const l = latestAttMap.get(m.id)!;
        return {
          id: `att:${m.id}`,
          entityId: m.id,
          kind: "attendance" as const,
          name: m.full_name,
          description: `${l.log_type} • ${formatDateTime(l.recorded_at, lang)}`,
          tool: m.room?.room_number ?? "-",
          owner: m.student_code,
          status: "Not Returned" as const,
          timestamp: formatDateTime(l.recorded_at, lang),
        };
      }),
      ...pendingViolations.slice(0, 10).map((v) => ({
        id: `viol:${v.id}`,
        entityId: v.id,
        kind: "violation" as const,
        name: v.member?.full_name ?? "-",
        description: v.description || v.violation_type,
        tool: v.member?.room?.room_number ?? "-",
        owner: v.penalty || "-",
        status: "Violations" as const,
        timestamp: formatDateTime(v.occurred_at, lang),
      })),
      ...raw.announcements.slice(0, 8).map((a) => ({
        id: `ann:${a.id}`,
        entityId: a.id,
        kind: "announcement" as const,
        name: a.title,
        description: a.content,
        tool: a.target_scope,
        owner: a.category,
        status: "Announcements" as const,
        timestamp: formatDateTime(a.published_at, lang),
      })),
    ];

    const activityRows = raw.attendanceLogs.slice(0, 10).map((l) => ({
      id: l.id,
      event: `${l.member?.full_name ?? "-"} (${l.log_type})`,
      source: l.member?.room?.room_number ?? "-",
      status:
        l.log_type === "check_in"
          ? "Complete"
          : l.log_type === "late" || l.log_type === "absent"
          ? "Needs review"
          : "Scheduled",
      time: formatDateTime(l.recorded_at, lang),
    }));

    return {
      lang,
      totalCollected,
      totalBilled,
      totalOutstanding,
      roomFeeSum,
      utilFeeSum,
      otherFeeSum,
      activeResidents: activeMembers.length,
      totalMembers: raw.members.length,
      availableRooms,
      totalRooms: raw.rooms.length,
      occupiedBeds,
      totalBeds,
      unpaidCount: unpaidList.length,
      notReturnedCount: notReturnedList.length,
      pendingViolationsCount: pendingViolations.length,
      monthlySeries,
      attendance7Days: Array.from(dayMap.values()),
      buildingBreakdown,
      activityRows,
      workItems,
    };
  }, [raw, lang]);

  const handleResolveWork = async (item: DormWorkItem) => {
    const supabase = createClient();
    if (!supabase || !user) return;

    if (item.kind === "payment") {
      const target = raw.payments.find((p) => p.id === item.entityId);
      if (!target) return;
      const { error } = await supabase
        .from("payments")
        .update({
          paid_amount: Number(target.amount),
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: "transfer",
          receipt_number: target.receipt_number || generateReceiptNumber(),
          recorded_by: user.id,
        })
        .eq("id", target.id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
    } else if (item.kind === "attendance") {
      const { error } = await supabase.from("attendance_logs").insert({
        member_id: item.entityId,
        log_type: "check_in",
        recorded_at: new Date().toISOString(),
        is_late: false,
        notes: "Check-in via GlassyDashboard",
        recorded_by: user.id,
      });
      if (error) {
        showToast(error.message, "error");
        return;
      }
    } else if (item.kind === "violation") {
      const { error } = await supabase
        .from("violations")
        .update({ status: "resolved" })
        .eq("id", item.entityId);
      if (error) {
        showToast(error.message, "error");
        return;
      }
    }

    showToast(
      lang === "vi" ? "Đã cập nhật thành công" : "อัปเดตข้อมูลเรียบร้อยแล้ว",
      "success"
    );
    invalidateCache();
    emitAlertsRefresh();
    await loadData(true);
  };

  return (
    <>
      <style>
        {"#root .w-screen:has(.gd-app) { width: 100%; min-width: 0; }"}
      </style>
      <GlassyDashboard
        workspaceName={lang === "vi" ? "KTX CONTROL" : "DORM CONTROL"}
        panelFrost={12}
        initialTheme={dark ? "dark" : "light"}
        backHref="/"
        dormData={dormData}
        onResolveWork={handleResolveWork}
      />
    </>
  );
}
