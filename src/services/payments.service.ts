"use client";

import type { FeeType, Payment, PaymentMethod, PaymentStatus } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface PaymentCreateInput {
  member_id: string;
  room_id: string | null;
  billing_month: string;
  fee_type: FeeType;
  amount: number;
  paid_amount?: number;
  status?: PaymentStatus;
  due_date?: string | null;
  paid_at?: string | null;
  payment_method?: PaymentMethod | null;
  receipt_number?: string | null;
  notes?: string | null;
  recorded_by?: string | null;
}

export async function listPayments(): Promise<Payment[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "*, member:members(*, room:rooms(*, building:buildings(*))), room:rooms(*, building:buildings(*))"
    )
    .order("created_at", { ascending: false });
  assertNoError(error, "Failed to load payments");
  return (data as Payment[]) ?? [];
}

export async function createPayment(input: PaymentCreateInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("payments").insert(input);
  assertNoError(error, "Failed to create payment");
  syncCaches(["fees_page", "dashboard_page", "alerts"], "payments");
}

export async function createPaymentsBatch(
  rows: PaymentCreateInput[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = requireSupabase();
  const { error } = await supabase.from("payments").insert(rows);
  assertNoError(error, "Failed to generate bills");
  syncCaches(["fees_page", "dashboard_page", "alerts"], "payments");
}

export async function updatePayment(
  id: string,
  payload: Partial<PaymentCreateInput>
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("payments")
    .update(payload)
    .eq("id", id);
  assertNoError(error, "Failed to update payment");
  syncCaches(["fees_page", "dashboard_page", "alerts"], "payments");
}

export async function deletePayment(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("payments").delete().eq("id", id);
  assertNoError(error, "Failed to delete payment");
  syncCaches(["fees_page", "dashboard_page", "alerts"], "payments");
}
