"use client";

import type {
  Announcement,
  AttendanceLog,
  Building,
  Member,
  Payment,
  Room,
  Violation,
} from "@/types/database";
import { assertNoError, requireSupabase } from "./supabaseHelper";

export interface DashboardSnapshot {
  members: Member[];
  buildings: Building[];
  rooms: Room[];
  payments: Payment[];
  attendance: AttendanceLog[];
  violations: Violation[];
  announcements: Announcement[];
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const supabase = requireSupabase();
  const [mRes, bRes, rRes, pRes, aRes, vRes, annRes] = await Promise.all([
    supabase
      .from("members")
      .select("*, room:rooms(*, building:buildings(*))")
      .order("created_at", { ascending: false }),
    supabase.from("buildings").select("*").order("code"),
    supabase.from("rooms").select("*, building:buildings(*)").order("room_number"),
    supabase
      .from("payments")
      .select(
        "*, member:members(*, room:rooms(*, building:buildings(*))), room:rooms(*, building:buildings(*))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance_logs")
      .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
      .order("recorded_at", { ascending: false })
      .limit(120),
    supabase
      .from("violations")
      .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("announcements")
      .select("*, building:buildings(*), room:rooms(*)")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(10),
  ]);

  assertNoError(mRes.error || bRes.error || rRes.error || pRes.error, "Failed to load dashboard data");

  return {
    members: (mRes.data as Member[]) ?? [],
    buildings: (bRes.data as Building[]) ?? [],
    rooms: (rRes.data as Room[]) ?? [],
    payments: (pRes.data as Payment[]) ?? [],
    attendance: (aRes.data as AttendanceLog[]) ?? [],
    violations: (vRes.data as Violation[]) ?? [],
    announcements: (annRes.data as Announcement[]) ?? [],
  };
}

export async function fetchReportsDataset() {
  const supabase = requireSupabase();
  const [bRes, mRes, pRes, aRes, vRes] = await Promise.all([
    supabase.from("buildings").select("*").order("code"),
    supabase
      .from("members")
      .select("*, room:rooms(*, building:buildings(*))")
      .order("full_name"),
    supabase
      .from("payments")
      .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance_logs")
      .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
      .order("recorded_at", { ascending: false })
      .limit(500),
    supabase
      .from("violations")
      .select("*, member:members(*, room:rooms(*, building:buildings(*)))")
      .order("occurred_at", { ascending: false }),
  ]);

  assertNoError(
    bRes.error || mRes.error || pRes.error || aRes.error || vRes.error,
    "Failed to load reports data"
  );

  return {
    buildings: (bRes.data as Building[]) ?? [],
    members: (mRes.data as Member[]) ?? [],
    payments: (pRes.data as Payment[]) ?? [],
    attendance: (aRes.data as AttendanceLog[]) ?? [],
    violations: (vRes.data as Violation[]) ?? [],
  };
}
