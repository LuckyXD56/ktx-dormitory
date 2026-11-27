"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { useI18n } from "@/lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = "danger",
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? t.common.confirmDeleteTitle}
      maxWidth="sm"
      role="alertdialog"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed pt-1">
            {description ?? t.common.confirmDeleteDesc}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors ${
              tone === "primary"
                ? "bg-navy-600 hover:bg-navy-700"
                : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {loading ? t.common.saving : (confirmLabel ?? t.common.confirm)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
