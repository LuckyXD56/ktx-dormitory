"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/layout/AppShell";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  getCached,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  AttendanceLog,
  Building,
  Member,
  Payment,
  Violation,
} from "@/types/database";

type ReportType =
  | "all_members"
  | "by_building_room"
  | "payments"
  | "attendance"
  | "violations";

export default function ReportsPage() {
  const { t, lang } = useI18n();
  const [reportType, setReportType] = useState<ReportType>("all_members");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const initialRep = getCached<{
    buildings: Building[];
    members: Member[];
    payments: Payment[];
    attendance: AttendanceLog[];
    violations: Violation[];
  }>("reports_page");

  const [loading, setLoading] = useState(!initialRep);
  const [buildings, setBuildings] = useState<Building[]>(
    initialRep?.buildings ?? []
  );
  const [members, setMembers] = useState<Member[]>(initialRep?.members ?? []);
  const [payments, setPayments] = useState<Payment[]>(
    initialRep?.payments ?? []
  );
  const [attendance, setAttendance] = useState<AttendanceLog[]>(
    initialRep?.attendance ?? []
  );
  const [violations, setViolations] = useState<Violation[]>(
    initialRep?.violations ?? []
  );

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("reports_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("reports_page")) setLoading(true);
    try {
      const [bRes, mRes, pRes, aRes, vRes] = await Promise.all([
        supabase.from("buildings").select("*").order("code"),
        supabase
          .from("members")
          .select("*, room:rooms(*, building:buildings(*))")
          .order("student_code"),
        supabase
          .from("payments")
          .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
          .order("billing_month", { ascending: false }),
        supabase
          .from("attendance_logs")
          .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
          .order("recorded_at", { ascending: false })
          .limit(500),
        supabase
          .from("violations")
          .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
          .order("occurred_at", { ascending: false }),
      ]);

      const payload = {
        buildings: (bRes.data as Building[]) ?? [],
        members: (mRes.data as Member[]) ?? [],
        payments: (pRes.data as Payment[]) ?? [],
        attendance: (aRes.data as AttendanceLog[]) ?? [],
        violations: (vRes.data as Violation[]) ?? [],
      };
      setBuildings(payload.buildings);
      setMembers(payload.members);
      setPayments(payload.payments);
      setAttendance(payload.attendance);
      setViolations(payload.violations);
      setCached("reports_page", payload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadData(true);
    });
  }, [loadData]);

  const inDateRange = useCallback(
    (isoDate: string) => {
      const d = isoDate.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    },
    [dateFrom, dateTo]
  );

  const reportData = useMemo(() => {
    if (reportType === "all_members") {
      const rows = members
        .filter(
          (m) =>
            buildingFilter === "all" || m.room?.building_id === buildingFilter
        )
        .map((m) => ({
          [t.members.studentCode]: m.student_code,
          [t.members.fullName]: m.full_name,
          [t.members.gender]: m.gender,
          [t.members.country]: m.country,
          [t.members.province]: m.province,
          [t.members.phone]: m.phone,
          [t.common.building]: m.room?.building?.name ?? "-",
          [t.common.room]: m.room?.room_number ?? t.members.unassigned,
          [t.members.checkInDate]: formatDate(m.check_in_date, lang),
          [t.common.status]: m.status,
        }));
      return rows;
    }

    if (reportType === "by_building_room") {
      const sorted = [...members]
        .filter(
          (m) =>
            buildingFilter === "all" || m.room?.building_id === buildingFilter
        )
        .sort((a, b) => {
          const ba = a.room?.building?.code ?? "ZZZ";
          const bb = b.room?.building?.code ?? "ZZZ";
          if (ba !== bb) return ba.localeCompare(bb);
          return (a.room?.room_number ?? "ZZZ").localeCompare(
            b.room?.room_number ?? "ZZZ"
          );
        });
      return sorted.map((m) => ({
        [t.common.building]: m.room?.building?.name ?? t.members.unassigned,
        [t.common.room]: m.room?.room_number ?? "-",
        [t.members.studentCode]: m.student_code,
        [t.members.fullName]: m.full_name,
        [t.members.phone]: m.phone,
        [t.common.status]: m.status,
      }));
    }

    if (reportType === "payments") {
      return payments
        .filter(
          (p) =>
            buildingFilter === "all" ||
            p.member?.room?.building_id === buildingFilter
        )
        .map((p) => ({
          [t.fees.billingMonth]: p.billing_month,
          [t.members.studentCode]: p.member?.student_code ?? "-",
          [t.common.member]: p.member?.full_name ?? "-",
          [t.common.room]: p.member?.room?.room_number ?? "-",
          [t.fees.feeType]: p.fee_type,
          [t.fees.amount]: Number(p.amount),
          [t.fees.paidAmount]: Number(p.paid_amount),
          [t.common.status]: p.status,
          [t.fees.receiptNumber]: p.receipt_number ?? "-",
        }));
    }

    if (reportType === "attendance") {
      return attendance
        .filter(
          (a) =>
            (buildingFilter === "all" ||
              a.member?.room?.building_id === buildingFilter) &&
            inDateRange(a.recorded_at)
        )
        .map((a) => ({
          [t.common.dateTime]: formatDateTime(a.recorded_at, lang),
          [t.members.studentCode]: a.member?.student_code ?? "-",
          [t.common.member]: a.member?.full_name ?? "-",
          [t.common.room]: a.member?.room?.room_number ?? "-",
          [t.common.status]: a.log_type,
          [t.common.notes]: a.notes ?? "-",
        }));
    }

    return violations
      .filter(
        (v) =>
          (buildingFilter === "all" ||
            v.member?.room?.building_id === buildingFilter) &&
          inDateRange(v.occurred_at)
      )
      .map((v) => ({
        [t.common.dateTime]: formatDateTime(v.occurred_at, lang),
        [t.members.studentCode]: v.member?.student_code ?? "-",
        [t.common.member]: v.member?.full_name ?? "-",
        [t.common.room]: v.member?.room?.room_number ?? "-",
        [t.violations.violationType]: v.violation_type,
        [t.violations.severity]: v.severity,
        [t.violations.penalty]: v.penalty || "-",
        [t.common.status]: v.status,
      }));
  }, [
    reportType,
    buildingFilter,
    members,
    payments,
    attendance,
    violations,
    inDateRange,
    t,
    lang,
  ]);

  const columns = useMemo(
    () => (reportData.length > 0 ? Object.keys(reportData[0]) : []),
    [reportData]
  );

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `dorm-report-${reportType}-${Date.now()}.xlsx`);
  };

  const handleExportCsv = () => {
    if (columns.length === 0) return;
    const escape = (val: unknown) =>
      `"${String(val ?? "").replaceAll('"', '""')}"`;
    const rows = [
      columns.map(escape).join(","),
      ...reportData.map((row) =>
        columns
          .map((col) => escape((row as Record<string, unknown>)[col] ?? ""))
          .join(",")
      ),
    ];
    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dorm-report-${reportType}-${Date.now()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const reportTitleMap: Record<ReportType, string> = {
    all_members: t.reports.repAllMembers,
    by_building_room: t.reports.repByBuildingRoom,
    payments: t.reports.repPayments,
    attendance: t.reports.repAttendance,
    violations: t.reports.repViolations,
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t.reports.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.reports.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reportData.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t.common.exportExcel}
            </button>
            <button
              type="button"
              disabled={reportData.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              disabled={reportData.length === 0}
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              {t.common.printPdf}
            </button>
          </div>
        </div>

        {/* Report Selector & Filters */}
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {t.reports.selectReport}
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all_members">{t.reports.repAllMembers}</option>
              <option value="by_building_room">
                {t.reports.repByBuildingRoom}
              </option>
              <option value="payments">{t.reports.repPayments}</option>
              <option value="attendance">{t.reports.repAttendance}</option>
              <option value="violations">{t.reports.repViolations}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {t.common.building}
            </label>
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">{t.common.all}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {t.reports.dateFrom}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {t.reports.dateTo}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Printable Report Preview */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden print:border-0 print:shadow-none">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {reportTitleMap[reportType]}
              </h2>
              <p className="text-xs text-slate-500">
                {t.appName} • {t.reports.totalRows}: {reportData.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-navy-600" />
              <span className="text-sm">{t.common.loading}</span>
            </div>
          ) : reportData.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {t.common.noData}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    {columns.map((col) => (
                      <th key={col} className="px-3 py-2.5 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-slate-400">{idx + 1}</td>
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="px-3 py-2.5 text-slate-800 whitespace-nowrap"
                        >
                          {String(
                            (row as Record<string, string | number>)[col] ?? "-"
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
