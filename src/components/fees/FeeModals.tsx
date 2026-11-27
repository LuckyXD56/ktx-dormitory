"use client";

import React from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  FeeType,
  Language,
  Member,
  Payment,
  PaymentMethod,
} from "@/types/database";

interface CreateBillModalProps {
  open: boolean;
  onClose: () => void;
  members: Member[];
  fMemberId: string;
  setFMemberId: (id: string) => void;
  fMonth: string;
  setFMonth: (m: string) => void;
  fType: FeeType;
  setFType: (t: FeeType) => void;
  fAmount: number;
  setFAmount: (a: number) => void;
  fDueDate: string;
  setFDueDate: (d: string) => void;
  fNotes: string;
  setFNotes: (n: string) => void;
  savingBill: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    addPayment: string;
    member: string;
    unassigned: string;
    billingMonth: string;
    feeType: string;
    typeRoom: string;
    typeWater: string;
    typeElectricity: string;
    typeFine: string;
    typeOther: string;
    amount: string;
    dueDate: string;
    notes: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function CreateBillModal({
  open,
  onClose,
  members,
  fMemberId,
  setFMemberId,
  fMonth,
  setFMonth,
  fType,
  setFType,
  fAmount,
  setFAmount,
  fDueDate,
  setFDueDate,
  fNotes,
  setFNotes,
  savingBill,
  onSubmit,
  labels,
}: CreateBillModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={labels.addPayment} maxWidth="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.member} *
          </label>
          <Select
            required
            value={fMemberId}
            onChange={(e) => {
              setFMemberId(e.target.value);
              const mem = members.find((m) => m.id === e.target.value);
              if (mem?.room && fType === "room_fee") {
                setFAmount(Number(mem.room.monthly_fee));
              }
            }}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.student_code} — {m.full_name} (
                {m.room?.room_number ?? labels.unassigned})
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.billingMonth}
            </label>
            <Input
              type="month"
              required
              value={fMonth}
              onChange={(e) => setFMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.feeType}
            </label>
            <Select
              value={fType}
              onChange={(e) => setFType(e.target.value as FeeType)}
            >
              <option value="room_fee">{labels.typeRoom}</option>
              <option value="water">{labels.typeWater}</option>
              <option value="electricity">{labels.typeElectricity}</option>
              <option value="fine">{labels.typeFine}</option>
              <option value="other">{labels.typeOther}</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.amount}
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              required
              value={fAmount}
              onChange={(e) => setFAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.dueDate}
            </label>
            <Input
              type="date"
              value={fDueDate}
              onChange={(e) => setFDueDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.notes}
          </label>
          <textarea
            rows={2}
            value={fNotes}
            onChange={(e) => setFNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-500/15"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={savingBill}
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {savingBill ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface RecordPaymentModalProps {
  payingItem: Payment | null;
  onClose: () => void;
  pAmount: number;
  setPAmount: (a: number) => void;
  pMethod: PaymentMethod;
  setPMethod: (m: PaymentMethod) => void;
  pDate: string;
  setPDate: (d: string) => void;
  pNotes: string;
  setPNotes: (n: string) => void;
  savingPay: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    recordPayment: string;
    amount: string;
    paymentMethod: string;
    methodTransfer: string;
    methodCash: string;
    methodQr: string;
    methodOther: string;
    paidAt: string;
    notes: string;
    cancel: string;
    confirm: string;
    saving: string;
  };
}

export function RecordPaymentModal({
  payingItem,
  onClose,
  pAmount,
  setPAmount,
  pMethod,
  setPMethod,
  pDate,
  setPDate,
  pNotes,
  setPNotes,
  savingPay,
  onSubmit,
  labels,
}: RecordPaymentModalProps) {
  return (
    <Modal
      open={Boolean(payingItem)}
      onClose={onClose}
      title={labels.recordPayment}
      subtitle={payingItem?.member?.full_name}
      maxWidth="sm"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.amount}
          </label>
          <Input
            type="number"
            min={1}
            step="0.01"
            required
            value={pAmount}
            onChange={(e) => setPAmount(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.paymentMethod}
          </label>
          <Select
            value={pMethod}
            onChange={(e) => setPMethod(e.target.value as PaymentMethod)}
          >
            <option value="transfer">{labels.methodTransfer}</option>
            <option value="cash">{labels.methodCash}</option>
            <option value="qr">{labels.methodQr}</option>
            <option value="other">{labels.methodOther}</option>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.paidAt}
          </label>
          <Input
            type="datetime-local"
            value={pDate}
            onChange={(e) => setPDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.notes}
          </label>
          <Input
            type="text"
            value={pNotes}
            onChange={(e) => setPNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={savingPay}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {savingPay ? labels.saving : labels.confirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ReceiptModalProps {
  receiptItem: Payment | null;
  onClose: () => void;
  lang: Language;
  feeTypeLabel: (ft: FeeType) => string;
  labels: {
    receiptTitle: string;
    appName: string;
    receiptNumber: string;
    member: string;
    room: string;
    billingMonth: string;
    feeType: string;
    paidAt: string;
    paidAmount: string;
    close: string;
    printPdf: string;
  };
}

export function ReceiptModal({
  receiptItem,
  onClose,
  lang,
  feeTypeLabel,
  labels,
}: ReceiptModalProps) {
  if (!receiptItem) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 print:static print:bg-white print:p-0">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 print:shadow-none print:border-0">
        <div className="text-center border-b border-slate-200 pb-4">
          <h2 className="text-lg font-bold text-navy-900">
            {labels.receiptTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{labels.appName}</p>
          <p className="text-xs font-mono text-navy-700 mt-1">
            {labels.receiptNumber}: {receiptItem.receipt_number || "-"}
          </p>
        </div>
        <div className="py-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">{labels.member}:</span>
            <span className="font-semibold">
              {receiptItem.member?.full_name} ({receiptItem.member?.student_code})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{labels.room}:</span>
            <span className="font-semibold">
              {receiptItem.member?.room
                ? `${receiptItem.member.room.building?.name ?? ""} / ${receiptItem.member.room.room_number}`
                : "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{labels.billingMonth}:</span>
            <span className="font-semibold">{receiptItem.billing_month}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{labels.feeType}:</span>
            <span className="font-semibold">
              {feeTypeLabel(receiptItem.fee_type)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{labels.paidAt}:</span>
            <span>{formatDate(receiptItem.paid_at, lang)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 mt-2 text-base font-bold text-emerald-700">
            <span>{labels.paidAmount}:</span>
            <span className="tabular-nums">
              {formatCurrency(Number(receiptItem.paid_amount), lang)}
            </span>
          </div>
        </div>
        <div className="no-print flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.close}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            <Printer className="h-4 w-4" />
            {labels.printPdf}
          </button>
        </div>
      </div>
    </div>
  );
}
