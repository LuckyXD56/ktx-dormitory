"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CreateBillModal, ReceiptModal, RecordPaymentModal } from "@/components/fees/FeeModals";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/StatCard";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import {
  createPayment,
  createPaymentsBatch,
  deletePayment,
  listMembers,
  listPayments,
  updatePayment,
} from "@/services";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import {
  formatCurrency,
  formatDateTime,
  generateReceiptNumber,
  getCurrentMonthYYYYMM,
} from "@/lib/utils";
import type {
  FeeType,
  Member,
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "@/types/database";

export default function FeesPage() {
  const { t, lang } = useI18n();
  const { user, isAdminOrAbove } = useAuth();
  const { showToast } = useToast();

  const initialFees = getCached<{ payments: Payment[]; members: Member[] }>(
    "fees_page"
  );
  const [payments, setPayments] = useState<Payment[]>(
    initialFees?.payments ?? []
  );
  const [members, setMembers] = useState<Member[]>(initialFees?.members ?? []);
  const [loading, setLoading] = useState(!initialFees);

  const [monthFilter, setMonthFilter] = useState(getCurrentMonthYYYYMM());
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Create Bill Modal
  const [addOpen, setAddOpen] = useState(false);
  const [fMemberId, setFMemberId] = useState("");
  const [fMonth, setFMonth] = useState(getCurrentMonthYYYYMM());
  const [fType, setFType] = useState<FeeType>("room_fee");
  const [fAmount, setFAmount] = useState(2500000);
  const [fDueDate, setFDueDate] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [savingBill, setSavingBill] = useState(false);

  // Pay Modal
  const [payingItem, setPayingItem] = useState<Payment | null>(null);
  const [pAmount, setPAmount] = useState(0);
  const [pMethod, setPMethod] = useState<PaymentMethod>("transfer");
  const [pDate, setPDate] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [savingPay, setSavingPay] = useState(false);

  // Receipt Modal
  const [receiptItem, setReceiptItem] = useState<Payment | null>(null);

  // Generate Monthly / Batch Pay
  const [generating, setGenerating] = useState(false);
  const [quickPayId, setQuickPayId] = useState<string | null>(null);
  const [batchPaying, setBatchPaying] = useState(false);
  const [confirmFeeAction, setConfirmFeeAction] = useState<
    "generate" | "batch_pay" | null
  >(null);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    if (!force && isCacheFresh("fees_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("fees_page")) setLoading(true);
    try {
      const [pData, mData] = await Promise.all([
        listPayments(),
        listMembers({ statuses: ["active", "on_leave"], orderBy: "full_name", ascending: true }),
      ]);
      const payload = {
        payments: pData,
        members: mData,
      };
      setPayments(payload.payments);
      setMembers(payload.members);
      setCached("fees_page", payload);
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
      const saved = window.sessionStorage.getItem("dorm_fees_filters");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          month?: string;
          status?: string;
        };
        if (parsed.month !== undefined) setMonthFilter(parsed.month);
        if (parsed.status) setStatusFilter(parsed.status);
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
        "dorm_fees_filters",
        JSON.stringify({ month: monthFilter, status: statusFilter })
      );
    } catch {
      // Ignore storage errors
    }
  }, [filtersReady, monthFilter, statusFilter]);

  const refreshFees = async () => {
    invalidateCache("fees_page");
    invalidateCache("dashboard_page");
    emitAlertsRefresh();
    await loadData(true);
  };

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (monthFilter && p.billing_month !== monthFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q) {
        const match =
          (p.member?.full_name ?? "").toLowerCase().includes(q) ||
          (p.member?.student_code ?? "").toLowerCase().includes(q) ||
          (p.receipt_number ?? "").toLowerCase().includes(q) ||
          (p.member?.room?.room_number ?? "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [payments, monthFilter, statusFilter, search]);

  const stats = useMemo(() => {
    const billed = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
    const collected = filteredPayments.reduce(
      (s, p) => s + Number(p.paid_amount),
      0
    );
    const outstanding = Math.max(0, billed - collected);
    const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;
    return { billed, collected, outstanding, rate };
  }, [filteredPayments]);

  const handleGenerateMonthly = async () => {
    setConfirmFeeAction(null);
    const targetMonth = monthFilter || getCurrentMonthYYYYMM();
    if (!user) return;
    setGenerating(true);
    try {
      const existingMemberIds = new Set(
        payments
          .filter(
            (p) =>
              p.billing_month === targetMonth && p.fee_type === "room_fee"
          )
          .map((p) => p.member_id)
      );

      const toInsert = members
        .filter((m) => !existingMemberIds.has(m.id) && m.room)
        .map((m) => ({
          member_id: m.id,
          room_id: m.room_id,
          billing_month: targetMonth,
          fee_type: "room_fee" as FeeType,
          amount: Number(m.room?.monthly_fee ?? 0),
          paid_amount: 0,
          status: "unpaid" as PaymentStatus,
          due_date: `${targetMonth}-05`,
          notes: t.fees.typeRoom,
          recorded_by: user.id,
        }));

      if (toInsert.length > 0) {
        await createPaymentsBatch(toInsert);
      }
      showToast(
        t.fees.generatedCount.replace("{n}", String(toInsert.length)),
        "success"
      );
      await refreshFees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setGenerating(false);
    }
  };

  const openCreateModal = () => {
    const first = members[0];
    setFMemberId(first?.id ?? "");
    setFMonth(monthFilter || getCurrentMonthYYYYMM());
    setFType("room_fee");
    setFAmount(Number(first?.room?.monthly_fee ?? 2500000));
    setFDueDate(`${monthFilter || getCurrentMonthYYYYMM()}-05`);
    setFNotes("");
    setAddOpen(true);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingBill(true);
    try {
      const member = members.find((m) => m.id === fMemberId);
      await createPayment({
        member_id: fMemberId,
        room_id: member?.room_id ?? null,
        billing_month: fMonth,
        fee_type: fType,
        amount: Number(fAmount),
        paid_amount: 0,
        status: "unpaid",
        due_date: fDueDate || null,
        notes: fNotes.trim(),
        recorded_by: user.id,
      });
      showToast(t.common.successSave, "success");
      setAddOpen(false);
      await refreshFees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingBill(false);
    }
  };

  const openPayModal = (p: Payment) => {
    setPayingItem(p);
    const remaining = Math.max(0, Number(p.amount) - Number(p.paid_amount));
    setPAmount(remaining > 0 ? remaining : Number(p.amount));
    setPMethod(p.payment_method ?? "transfer");
    const now = new Date();
    setPDate(
      new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    );
    setPNotes(p.notes ?? "");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingItem || !user) return;
    setSavingPay(true);
    try {
      const nextPaid = Math.min(
        Number(payingItem.amount),
        Number(payingItem.paid_amount) + Number(pAmount)
      );
      const nextStatus: PaymentStatus =
        nextPaid >= Number(payingItem.amount)
          ? "paid"
          : nextPaid > 0
          ? "partial"
          : "unpaid";

      await updatePayment(payingItem.id, {
        paid_amount: nextPaid,
        status: nextStatus,
        paid_at: pDate ? new Date(pDate).toISOString() : new Date().toISOString(),
        payment_method: pMethod,
        receipt_number:
          payingItem.receipt_number || generateReceiptNumber(),
        notes: pNotes.trim(),
        recorded_by: user.id,
      });
      showToast(t.common.successSave, "success");
      setPayingItem(null);
      await refreshFees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingPay(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await deletePayment(deletingId);
      showToast(t.common.successDelete, "success");
      setDeletingId(null);
      await refreshFees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setDeleting(false);
    }
  };

  const unpaidFiltered = useMemo(
    () => filteredPayments.filter((p) => p.status !== "paid"),
    [filteredPayments]
  );

  const handleQuickPayFull = async (item: Payment) => {
    if (!user) return;
    setQuickPayId(item.id);
    try {
      await updatePayment(item.id, {
        paid_amount: Number(item.amount),
        status: "paid" as PaymentStatus,
        paid_at: new Date().toISOString(),
        payment_method: "transfer" as PaymentMethod,
        receipt_number: item.receipt_number || generateReceiptNumber(),
        recorded_by: user.id,
      });
      showToast(t.common.successSave, "success");
      await refreshFees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setQuickPayId(null);
    }
  };

  const handleBatchPayVisible = async () => {
    setConfirmFeeAction(null);
    if (unpaidFiltered.length === 0 || !user) return;
    setBatchPaying(true);
    try {
      const now = new Date().toISOString();
      await Promise.all(
        unpaidFiltered.map((p) =>
          updatePayment(p.id, {
            paid_amount: Number(p.amount),
            status: "paid" as PaymentStatus,
            paid_at: now,
            payment_method: "transfer" as PaymentMethod,
            receipt_number: p.receipt_number || generateReceiptNumber(),
            recorded_by: user.id,
          })
        )
      );
      showToast(t.common.successSave, "success");
      await refreshFees();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setBatchPaying(false);
    }
  };

  const feeTypeLabel = (ft: FeeType) => {
    switch (ft) {
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

  const renderStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case "paid":
        return <Badge variant="emerald">{t.fees.statusPaid}</Badge>;
      case "partial":
        return <Badge variant="amber">{t.fees.statusPartial}</Badge>;
      default:
        return <Badge variant="rose">{t.fees.statusUnpaid}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          className="no-print"
          title={t.fees.title}
          subtitle={t.fees.subtitle}
          actions={
            <>
              {unpaidFiltered.length > 1 && (
                <Button
                  type="button"
                  disabled={batchPaying}
                  onClick={() => setConfirmFeeAction("batch_pay")}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {batchPaying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {lang === "vi"
                    ? `Thu đủ (${unpaidFiltered.length})`
                    : `รับชำระทั้งหมด (${unpaidFiltered.length})`}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={generating}
                onClick={() => setConfirmFeeAction("generate")}
                className="border-navy-200 bg-navy-50 text-navy-800 hover:bg-navy-100"
              >
                <Sparkles className="h-4 w-4" />
                {t.fees.generateMonthly}
              </Button>
              <Button type="button" onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                {t.fees.addPayment}
              </Button>
            </>
          }
        />

        {/* Summary Cards */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label={t.fees.totalBilled}
            value={formatCurrency(stats.billed, lang)}
          />
          <StatCard
            tone="emerald"
            label={t.fees.totalCollected}
            value={formatCurrency(stats.collected, lang)}
          />
          <StatCard
            tone="rose"
            label={t.fees.totalOutstanding}
            value={formatCurrency(stats.outstanding, lang)}
          />
          <StatCard
            tone="navy"
            label={t.fees.collectionRate}
            value={`${stats.rate}%`}
          />
        </div>

        {/* Filters */}
        <FilterBar
          hasActiveFilters={
            Boolean(search.trim()) ||
            statusFilter !== "all" ||
            monthFilter !== getCurrentMonthYYYYMM()
          }
          onReset={() => {
            setSearch("");
            setStatusFilter("all");
            setMonthFilter(getCurrentMonthYYYYMM());
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
            <div className="flex items-center gap-2">
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="flex-1"
              />
              {monthFilter && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthFilter("")}
                >
                  {t.common.all}
                </Button>
              )}
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">
                {t.common.status}: {t.common.all}
              </option>
              <option value="unpaid">{t.fees.statusUnpaid}</option>
              <option value="partial">{t.fees.statusPartial}</option>
              <option value="paid">{t.fees.statusPaid}</option>
            </Select>
          </div>
        </FilterBar>

        {/* Payments Table & Mobile Cards */}
        <div className="no-print rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filteredPayments.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-6 w-6" />}
              title={t.common.noData}
              action={
                <Button type="button" size="sm" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" />
                  {t.fees.addPayment}
                </Button>
              }
            />
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <div key={p.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {p.member?.full_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.member?.student_code} •{" "}
                          {p.member?.room
                            ? `${p.member.room.building?.code ?? ""}-${p.member.room.room_number}`
                            : t.members.unassigned}
                        </p>
                      </div>
                      {renderStatusBadge(p.status)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">
                        {p.billing_month} • {feeTypeLabel(p.fee_type)}
                      </span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {formatCurrency(Number(p.paid_amount), lang)} /{" "}
                        {formatCurrency(Number(p.amount), lang)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                      {p.status !== "paid" && (
                        <>
                          <button
                            type="button"
                            disabled={quickPayId === p.id}
                            onClick={() => handleQuickPayFull(p)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {lang === "vi" ? "Đủ" : "จ่ายครบ"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openPayModal(p)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {t.fees.recordPayment}
                          </button>
                        </>
                      )}
                      {p.paid_amount > 0 && (
                        <button
                          type="button"
                          onClick={() => setReceiptItem(p)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-navy-50"
                          title={t.fees.printReceipt}
                        >
                          <Receipt className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingId(p.id)}
                        className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                        title={t.common.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{t.common.member}</th>
                    <th className="px-4 py-3">{t.fees.billingMonth}</th>
                    <th className="px-4 py-3">{t.fees.feeType}</th>
                    <th className="px-4 py-3">{t.fees.amount}</th>
                    <th className="px-4 py-3">{t.fees.paidAmount}</th>
                    <th className="px-4 py-3">{t.common.status}</th>
                    <th className="px-4 py-3 hidden md:table-cell">
                      {t.fees.paidAt}
                    </th>
                    <th className="px-4 py-3 text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {p.member?.full_name ?? "-"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {p.member?.student_code} •{" "}
                          {p.member?.room
                            ? `${p.member.room.building?.code ?? ""}-${p.member.room.room_number}`
                            : t.members.unassigned}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {p.billing_month}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {feeTypeLabel(p.fee_type)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {formatCurrency(Number(p.amount), lang)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {formatCurrency(Number(p.paid_amount), lang)}
                      </td>
                      <td className="px-4 py-3">{renderStatusBadge(p.status)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                        {p.paid_at ? formatDateTime(p.paid_at, lang) : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {p.status !== "paid" && (
                            <>
                              <button
                                type="button"
                                disabled={quickPayId === p.id}
                                onClick={() => handleQuickPayFull(p)}
                                title={
                                  lang === "vi"
                                    ? "Thanh toán đủ ngay"
                                    : "รับชำระครบจำนวนทันที"
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                {quickPayId === p.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                {lang === "vi" ? "Đủ" : "จ่ายครบ"}
                              </button>
                              <button
                                type="button"
                                onClick={() => openPayModal(p)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                {t.fees.recordPayment}
                              </button>
                            </>
                          )}
                          {p.paid_amount > 0 && (
                            <button
                              type="button"
                              onClick={() => setReceiptItem(p)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-700"
                              title={t.fees.printReceipt}
                            >
                              <Receipt className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeletingId(p.id)}
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
            </>
          )}
        </div>
      </div>

      <CreateBillModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        members={members}
        fMemberId={fMemberId}
        setFMemberId={setFMemberId}
        fMonth={fMonth}
        setFMonth={setFMonth}
        fType={fType}
        setFType={setFType}
        fAmount={fAmount}
        setFAmount={setFAmount}
        fDueDate={fDueDate}
        setFDueDate={setFDueDate}
        fNotes={fNotes}
        setFNotes={setFNotes}
        savingBill={savingBill}
        onSubmit={handleCreateBill}
        labels={{
          addPayment: t.fees.addPayment,
          member: t.common.member,
          unassigned: t.members.unassigned,
          billingMonth: t.fees.billingMonth,
          feeType: t.fees.feeType,
          typeRoom: t.fees.typeRoom,
          typeWater: t.fees.typeWater,
          typeElectricity: t.fees.typeElectricity,
          typeFine: t.fees.typeFine,
          typeOther: t.fees.typeOther,
          amount: t.fees.amount,
          dueDate: t.fees.dueDate,
          notes: t.common.notes,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <RecordPaymentModal
        payingItem={payingItem}
        onClose={() => setPayingItem(null)}
        pAmount={pAmount}
        setPAmount={setPAmount}
        pMethod={pMethod}
        setPMethod={setPMethod}
        pDate={pDate}
        setPDate={setPDate}
        pNotes={pNotes}
        setPNotes={setPNotes}
        savingPay={savingPay}
        onSubmit={handleRecordPayment}
        labels={{
          recordPayment: t.fees.recordPayment,
          amount: t.fees.amount,
          paymentMethod: t.fees.paymentMethod,
          methodTransfer: t.fees.methodTransfer,
          methodCash: t.fees.methodCash,
          methodQr: t.fees.methodQr,
          methodOther: t.fees.methodOther,
          paidAt: t.fees.paidAt,
          notes: t.common.notes,
          cancel: t.common.cancel,
          confirm: t.common.confirm,
          saving: t.common.saving,
        }}
      />

      <ReceiptModal
        receiptItem={receiptItem}
        onClose={() => setReceiptItem(null)}
        lang={lang}
        feeTypeLabel={feeTypeLabel}
        labels={{
          receiptTitle: t.fees.receiptTitle,
          appName: t.appName,
          receiptNumber: t.fees.receiptNumber,
          member: t.common.member,
          room: t.common.room,
          billingMonth: t.fees.billingMonth,
          feeType: t.fees.feeType,
          paidAt: t.fees.paidAt,
          paidAmount: t.fees.paidAmount,
          close: t.common.close,
          printPdf: t.common.printPdf,
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={confirmFeeAction !== null}
        onClose={() => setConfirmFeeAction(null)}
        onConfirm={
          confirmFeeAction === "generate"
            ? handleGenerateMonthly
            : handleBatchPayVisible
        }
        loading={generating || batchPaying}
        title={
          confirmFeeAction === "generate"
            ? t.fees.generateMonthly
            : lang === "vi"
              ? `Thu đủ (${unpaidFiltered.length})`
              : `รับชำระทั้งหมด (${unpaidFiltered.length})`
        }
        description={
          confirmFeeAction === "generate"
            ? t.fees.generateConfirm.replace(
                "{month}",
                monthFilter || getCurrentMonthYYYYMM()
              )
            : lang === "vi"
              ? `Xác nhận đánh dấu ĐÃ THANH TOÁN ĐỦ cho ${unpaidFiltered.length} hóa đơn đang lọc?`
              : `ยืนยันรับชำระครบจำนวนทั้งหมด ${unpaidFiltered.length} บิลที่แสดงอยู่?`
        }
        confirmLabel={t.common.confirm}
      />
    </AppShell>
  );
}
