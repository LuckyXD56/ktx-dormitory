import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Language } from "@/types/database";
import { LANGUAGE_MAP } from "@/lib/i18n/languages";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getIntlLocale(lang: Language): string {
  return LANGUAGE_MAP[lang]?.intlLocale ?? "th-TH";
}

export function formatCurrency(amount: number, lang: Language = "th"): string {
  const formatted = new Intl.NumberFormat(getIntlLocale(lang), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
  return `${formatted} ${lang === "th" ? "₫" : "VND"}`;
}

export function formatDate(
  value: string | null | undefined,
  lang: Language = "th"
): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getIntlLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(
  value: string | null | undefined,
  lang: Language = "th"
): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getIntlLocale(lang), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getInitials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getCurrentMonthYYYYMM(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getTodayYYYYMMDD(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function generateReceiptNumber(seq?: number): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = seq
    ? String(seq).padStart(4, "0")
    : String(Math.floor(1000 + Math.random() * 9000));
  return `RCP-${ym}-${rand}`;
}
