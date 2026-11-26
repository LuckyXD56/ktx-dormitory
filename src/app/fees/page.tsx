"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  Printer,
  Receipt,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
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
  formatDate,
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
  const [fAmount, setFAmount] = useState(2500);
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

  // Generate Monthly
  const [generating, setGenerating] = useState(false);
  const [quickPayId, setQuickPayId] = useState<string | null>(null);
  const [batchPaying, setBatchPaying] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("fees_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("fees_page")) setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        supabase
          .from("payments")
          .select(
            "*, member:members(*, room:rooms(*, building:buildings(*))), room:rooms(*, building:buildings(*))"
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("members")
          .select("*, room:rooms(*, building:buildings(*))")
          .in("status", ["active", "on_leave"])
          .order("full_name"),
      ]);
      const payload = {
        payments: (pRes.data as Payment[]) ?? [],
        members: (mRes.data as Member[]) ?? [],
      };
      setPayments(payload.payments);
      setMembers(payload.members);
      setCached("fees_page", payload);
    } finally {
      setLoading(false);
    }
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
    const targetMonth = monthFilter || getCurrentMonthYYYYMM();
    const confirmMsg = t.fees.generateConfirm.replace("{month}", targetMonth);
    if (!window.confirm(confirmMsg)) return;

    const supabase = createClient();
    if (!supabase || !user) return;
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
        const { error } = await supabase.from("payments").insert(toInsert);
        if (error) {
          showToast(error.message, "error");
          return;
        }
      }
      showToast(
        t.fees.generatedCount.replace("{n}", String(toInsert.length)),
        "success"
      );
      await refreshFees();
    } finally {
      setGenerating(false);
    }
  };

  const openCreateModal = () => {
    const first = members[0];
    setFMemberId(first?.id ?? "");
    setFMonth(monthFilter || getCurrentMonthYYYYMM());
    setFType("room_fee");
    setFAmount(Number(first?.room?.monthly_fee ?? 2500));
    setFDueDate(`${monthFilter || getCurrentMonthYYYYMM()}-05`);
    setFNotes("");
    setAddOpen(true);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase || !user) return;
    setSavingBill(true);
    try {
      const member = members.find((m) => m.id === fMemberId);
      const { error } = await supabase.from("payments").insert({
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
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setAddOpen(false);
      await refreshFees();
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
    if (!payingItem) return;
    const supabase = createClient();
    if (!supabase || !user) return;
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

      const { error } = await supabase
        .from("payments")
        .update({
          paid_amount: nextPaid,
          status: nextStatus,
          paid_at: pDate ? new Date(pDate).toISOString() : new Date().toISOString(),
          payment_method: pMethod,
          receipt_number:
            payingItem.receipt_number || generateReceiptNumber(),
          notes: pNotes.trim(),
          recorded_by: user.id,
        })
        .eq("id", payingItem.id);

      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setPayingItem(null);
      await refreshFees();
    } finally {
      setSavingPay(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const supabase = createClient();
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", deletingId);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successDelete, "success");
      setDeletingId(null);
      await refreshFees();
    } finally {
      setDeleting(false);
    }
  };

  const unpaidFiltered = useMemo(
    () => filteredPayments.filter((p) => p.status !== "paid"),
    [filteredPayments]
  );

  const handleQuickPayFull = async (item: Payment) => {
    const supabase = createClient();
    if (!supabase || !user) return;
    setQuickPayId(item.id);
    try {
      const { error } = await supabase
        .from("payments")
        .update({
          paid_amount: Number(item.amount),
          status: "paid" as PaymentStatus,
          paid_at: new Date().toISOString(),
          payment_method: "transfer" as PaymentMethod,
          receipt_number: item.receipt_number || generateReceiptNumber(),
          recorded_by: user.id,
        })
        .eq("id", item.id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      await refreshFees();
    } finally {
      setQuickPayId(null);
    }
  };

  const handleBatchPayVisible = async () => {
    if (unpaidFiltered.length === 0) return;
    const msg =
      lang === "vi"
        ? `Xác nhận đánh dấu ĐÃ THANH TOÁN ĐỦ cho ${unpaidFiltered.length} hóa đơn đang lọc?`
        : `ยืนยันรับชำระครบจำนวนทั้งหมด ${unpaidFiltered.length} บิลที่แสดงอยู่?`;
    if (!window.confirm(msg)) return;
    const supabase = createClient();
    if (!supabase || !user) return;
    setBatchPaying(true);
    try {
      const now = new Date().toISOString();
      const results = await Promise.all(
        unpaidFiltered.map((p) =>
          supabase
            .from("payments")
            .update({
              paid_amount: Number(p.amount),
              status: "paid" as PaymentStatus,
              paid_at: now,
              payment_method: "transfer" as PaymentMethod,
              receipt_number: p.receipt_number || generateReceiptNumber(),
              recorded_by: user.id,
            })
            .eq("id", p.id)
        )
      );
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) {
        showToast(firstErr.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      await refreshFees();
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
        <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t.fees.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.fees.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unpaidFiltered.length > 1 && (
              <button
                type="button"
                disabled={batchPaying}
                onClick={handleBatchPayVisible}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {batchPaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {lang === "vi"
                  ? `Thu đủ (${unpaidFiltered.length})`
                  : `รับชำระทั้งหมด (${unpaidFiltered.length})`}
              </button>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateMonthly}
              className="inline-flex items-center gap-1.5 rounded-xl border border-navy-200 bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-100 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {t.fees.generateMonthly}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <Plus className="h-4 w-4" />
              {t.fees.addPayment}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">
              {t.fees.totalBilled}
            </p>
            <p className="mt-1.5 text-xl font-bold text-slate-900">
              {formatCurrency(stats.billed, lang)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="text-xs font-medium text-emerald-700">
              {t.fees.totalCollected}
            </p>
            <p className="mt-1.5 text-xl font-bold text-emerald-800">
              {formatCurrency(stats.collected, lang)}
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
            <p className="text-xs font-medium text-rose-700">
              {t.fees.totalOutstanding}
            </p>
            <p className="mt-1.5 text-xl font-bold text-rose-800">
              {formatCurrency(stats.outstanding, lang)}
            </p>
          </div>
          <div className="rounded-2xl border border-navy-200 bg-navy-50/40 p-4">
            <p className="text-xs font-medium text-navy-700">
              {t.fees.collectionRate}
            </p>
            <p className="mt-1.5 text-xl font-bold text-navy-900">
              {stats.rate}%
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="no-print rounded-2xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.members.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-navy-600 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            {monthFilter && (
              <button
                type="button"
                onClick={() => setMonthFilter("")}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
              >
                {t.common.all}
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">
              {t.common.status}: {t.common.all}
            </option>
            <option value="unpaid">{t.fees.statusUnpaid}</option>
            <option value="partial">{t.fees.statusPartial}</option>
            <option value="paid">{t.fees.statusPaid}</option>
          </select>
        </div>

        {/* Payments Table */}
        <div className="no-print rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-navy-600" />
              <span className="text-sm">{t.common.loading}</span>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {t.common.noData}
            </div>
          ) : (
            <div className="overflow-x-auto">
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
          )}
        </div>
      </div>

      {/* Create Bill Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t.fees.addPayment}
        maxWidth="md"
      >
        <form onSubmit={handleCreateBill} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.common.member} *
            </label>
            <select
              required
              value={fMemberId}
              onChange={(e) => {
                setFMemberId(e.target.value);
                const mem = members.find((m) => m.id === e.target.value);
                if (mem?.room && fType === "room_fee") {
                  setFAmount(Number(mem.room.monthly_fee));
                }
              }}
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
                {t.fees.billingMonth}
              </label>
              <input
                type="month"
                required
                value={fMonth}
                onChange={(e) => setFMonth(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.fees.feeType}
              </label>
              <select
                value={fType}
                onChange={(e) => setFType(e.target.value as FeeType)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="room_fee">{t.fees.typeRoom}</option>
                <option value="water">{t.fees.typeWater}</option>
                <option value="electricity">{t.fees.typeElectricity}</option>
                <option value="fine">{t.fees.typeFine}</option>
                <option value="other">{t.fees.typeOther}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.fees.amount}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={fAmount}
                onChange={(e) => setFAmount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.fees.dueDate}
              </label>
              <input
                type="date"
                value={fDueDate}
                onChange={(e) => setFDueDate(e.target.value)}
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
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingBill}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {savingBill ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(payingItem)}
        onClose={() => setPayingItem(null)}
        title={t.fees.recordPayment}
        subtitle={payingItem?.member?.full_name}
        maxWidth="sm"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.fees.amount}
            </label>
            <input
              type="number"
              min={1}
              step="0.01"
              required
              value={pAmount}
              onChange={(e) => setPAmount(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.fees.paymentMethod}
            </label>
            <select
              value={pMethod}
              onChange={(e) => setPMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="transfer">{t.fees.methodTransfer}</option>
              <option value="cash">{t.fees.methodCash}</option>
              <option value="qr">{t.fees.methodQr}</option>
              <option value="other">{t.fees.methodOther}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.fees.paidAt}
            </label>
            <input
              type="datetime-local"
              value={pDate}
              onChange={(e) => setPDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.common.notes}
            </label>
            <input
              type="text"
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPayingItem(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingPay}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              {savingPay ? t.common.saving : t.common.confirm}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Receipt Modal */}
      {receiptItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 print:static print:bg-white print:p-0">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 print:shadow-none print:border-0">
            <div className="text-center border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-navy-900">
                {t.fees.receiptTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{t.appName}</p>
              <p className="text-xs font-mono text-navy-700 mt-1">
                {t.fees.receiptNumber}: {receiptItem.receipt_number || "-"}
              </p>
            </div>
            <div className="py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t.common.member}:</span>
                <span className="font-semibold">
                  {receiptItem.member?.full_name} (
                  {receiptItem.member?.student_code})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.common.room}:</span>
                <span className="font-semibold">
                  {receiptItem.member?.room
                    ? `${receiptItem.member.room.building?.name ?? ""} / ${receiptItem.member.room.room_number}`
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.fees.billingMonth}:</span>
                <span className="font-semibold">{receiptItem.billing_month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.fees.feeType}:</span>
                <span className="font-semibold">
                  {feeTypeLabel(receiptItem.fee_type)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t.fees.paidAt}:</span>
                <span>{formatDate(receiptItem.paid_at, lang)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 mt-2 text-base font-bold text-emerald-700">
                <span>{t.fees.paidAmount}:</span>
                <span>
                  {formatCurrency(Number(receiptItem.paid_amount), lang)}
                </span>
              </div>
            </div>
            <div className="no-print flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiptItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                {t.common.close}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
              >
                <Printer className="h-4 w-4" />
                {t.common.printPdf}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppShell>
  );
}
