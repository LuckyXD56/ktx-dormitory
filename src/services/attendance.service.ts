"use client";

import type { AttendanceLog, AttendanceLogType } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface AttendanceLogInput {
  member_id: string;
  log_type: AttendanceLogType;
  recorded_at?: string;
  is_late?: boolean;
  notes?: string;
  recorded_by?: string | null;
}

export async function listAttendanceLogs(limit = 300): Promise<AttendanceLog[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("attendance_logs")
    .select(
      "*, member:members(*, room:rooms(*, building:buildings(*))), recorder:profiles(id, full_name, role)"
    )
    .order("recorded_at", { ascending: false })
    .limit(limit);
  assertNoError(error, "Failed to load attendance logs");
  return (data as AttendanceLog[]) ?? [];
}

export async function createAttendanceLog(
  input: AttendanceLogInput
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("attendance_logs").insert(input);
  assertNoError(error, "Failed to create attendance log");
  syncCaches(["attendance_page", "dashboard_page", "alerts"], "attendance");
}

export async function createAttendanceLogsBatch(
  rows: AttendanceLogInput[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = requireSupabase();
  const { error } = await supabase.from("attendance_logs").insert(rows);
  assertNoError(error, "Failed to save batch attendance");
  syncCaches(["attendance_page", "dashboard_page", "alerts"], "attendance");
}

export async function deleteAttendanceLog(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("attendance_logs").delete().eq("id", id);
  assertNoError(error, "Failed to delete attendance log");
  syncCaches(["attendance_page", "dashboard_page", "alerts"], "attendance");
}
