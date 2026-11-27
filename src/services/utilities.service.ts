"use client";

import type { UtilityReading } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface UtilityReadingInput {
  room_id: string;
  billing_month: string;
  elec_prev: number;
  elec_curr: number;
  elec_rate: number;
  water_prev: number;
  water_curr: number;
  water_rate: number;
  billed_to_payments?: boolean;
  notes?: string | null;
  recorded_by?: string | null;
}

export async function listUtilityReadings(
  billingMonth: string
): Promise<UtilityReading[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("utility_readings")
    .select("*, room:rooms(*, building:buildings(*))")
    .eq("billing_month", billingMonth)
    .order("created_at", { ascending: false });
  assertNoError(error, "Failed to load utility readings");
  return (data as UtilityReading[]) ?? [];
}

export async function upsertUtilityReadingsBatch(
  rows: UtilityReadingInput[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("utility_readings")
    .upsert(rows, { onConflict: "room_id,billing_month" });
  assertNoError(error, "Failed to save utility readings");
  syncCaches(["utilities_page", "fees_page", "dashboard_page"], "utility_readings");
}

export async function markUtilitiesBilled(
  roomIds: string[],
  billingMonth: string
): Promise<void> {
  if (roomIds.length === 0) return;
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("utility_readings")
    .update({ billed_to_payments: true })
    .eq("billing_month", billingMonth)
    .in("room_id", roomIds);
  assertNoError(error, "Failed to mark utility readings as billed");
  syncCaches(["utilities_page", "fees_page"], "utility_readings");
}
