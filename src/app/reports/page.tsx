"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { fetchReportsDataset } from "@/services";
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
  const { showToast } = useToast();
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
      const payload = await fetchReportsDataset();
      setBuildings(payload.buildings);
      setMembers(payload.members);
      setPayments(payload.payments);
      setAttendance(payload.attendance);
      setViolations(payload.violations);
      setCached("reports_page", payload);
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
        <PageHeader
          className="no-print"
          title={t.reports.title}
          subtitle={t.reports.subtitle}
          actions={
            <>
              <Button
                type="button"
                disabled={reportData.length === 0}
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t.common.exportExcel}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={reportData.length === 0}
                onClick={handleExportCsv}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                type="button"
                disabled={reportData.length === 0}
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                {t.common.printPdf}
              </Button>
            </>
          }
        />

        {/* Report Selector & Filters */}
        <FilterBar
          hasActiveFilters={
            buildingFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo)
          }
          onReset={() => {
            setBuildingFilter("all");
            setDateFrom("");
            setDateTo("");
          }}
          resetLabel={t.common.reset}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.reports.selectReport}
              </label>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
              >
                <option value="all_members">{t.reports.repAllMembers}</option>
                <option value="by_building_room">
                  {t.reports.repByBuildingRoom}
                </option>
                <option value="payments">{t.reports.repPayments}</option>
                <option value="attendance">{t.reports.repAttendance}</option>
                <option value="violations">{t.reports.repViolations}</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.common.building}
              </label>
              <Select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
              >
                <option value="all">{t.common.all}</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.reports.dateFrom}
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.reports.dateTo}
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </FilterBar>

        {/* Printable Report Preview */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden print:border-0 print:shadow-none">
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
            <TableSkeleton rows={6} cols={5} />
          ) : reportData.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-6 w-6" />}
              title={t.common.noData}
            />
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
