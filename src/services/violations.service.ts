"use client";

import type { Violation, ViolationSeverity, ViolationStatus } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface ViolationInput {
  member_id: string;
  violation_type: string;
  severity: ViolationSeverity;
  occurred_at: string;
  description: string;
  evidence_url?: string | null;
  penalty: string;
  status: ViolationStatus;
  recorded_by?: string | null;
}

export async function listViolations(): Promise<Violation[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("violations")
    .select(
      "*, member:members(*, room:rooms(*, building:buildings(*))), recorder:profiles(id, full_name, role)"
    )
    .order("occurred_at", { ascending: false });
  assertNoError(error, "Failed to load violations");
  return (data as Violation[]) ?? [];
}

export async function createViolation(input: ViolationInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("violations").insert(input);
  assertNoError(error, "Failed to record violation");
  syncCaches(["violations_page", "dashboard_page", "alerts"], "violations");
}

export async function updateViolation(
  id: string,
  input: Partial<ViolationInput>
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("violations")
    .update(input)
    .eq("id", id);
  assertNoError(error, "Failed to update violation");
  syncCaches(["violations_page", "dashboard_page", "alerts"], "violations");
}

export async function deleteViolation(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("violations").delete().eq("id", id);
  assertNoError(error, "Failed to delete violation");
  syncCaches(["violations_page", "dashboard_page", "alerts"], "violations");
}
