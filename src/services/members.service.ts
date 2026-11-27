"use client";

import type { Member, MemberGender, MemberStatus } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface MemberInput {
  student_code: string;
  full_name: string;
  avatar_url?: string | null;
  gender: MemberGender;
  country: string;
  province: string;
  phone: string;
  room_id?: string | null;
  check_in_date: string;
  status: MemberStatus;
  notes?: string | null;
}

export async function listMembers(options?: {
  statuses?: MemberStatus[];
  orderBy?: "created_at" | "full_name";
  ascending?: boolean;
}): Promise<Member[]> {
  const supabase = requireSupabase();
  let query = supabase
    .from("members")
    .select("*, room:rooms(*, building:buildings(*))");

  if (options?.statuses && options.statuses.length > 0) {
    query = query.in("status", options.statuses);
  }

  query = query.order(options?.orderBy ?? "created_at", {
    ascending: options?.ascending ?? false,
  });

  const { data, error } = await query;
  assertNoError(error, "Failed to load members");
  return (data as Member[]) ?? [];
}

export async function createMember(input: MemberInput): Promise<Member> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("members")
    .insert({
      student_code: input.student_code.trim(),
      full_name: input.full_name.trim(),
      avatar_url: input.avatar_url || null,
      gender: input.gender,
      country: input.country.trim(),
      province: input.province.trim(),
      phone: input.phone.trim(),
      room_id: input.room_id || null,
      check_in_date: input.check_in_date,
      status: input.status,
      notes: input.notes?.trim() ?? "",
    })
    .select("*, room:rooms(*, building:buildings(*))")
    .single();
  assertNoError(error, "Failed to create member");
  syncCaches(
    ["members_page", "rooms_page", "dashboard_page", "attendance_page", "fees_page", "command_index"],
    "members"
  );
  return data as Member;
}

export async function updateMember(
  id: string,
  input: Partial<MemberInput>
): Promise<void> {
  const supabase = requireSupabase();
  const payload: Record<string, unknown> = {};
  if (input.student_code !== undefined) payload.student_code = input.student_code.trim();
  if (input.full_name !== undefined) payload.full_name = input.full_name.trim();
  if (input.avatar_url !== undefined) payload.avatar_url = input.avatar_url || null;
  if (input.gender !== undefined) payload.gender = input.gender;
  if (input.country !== undefined) payload.country = input.country.trim();
  if (input.province !== undefined) payload.province = input.province.trim();
  if (input.phone !== undefined) payload.phone = input.phone.trim();
  if (input.room_id !== undefined) payload.room_id = input.room_id || null;
  if (input.check_in_date !== undefined) payload.check_in_date = input.check_in_date;
  if (input.status !== undefined) payload.status = input.status;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() ?? "";

  const { error } = await supabase.from("members").update(payload).eq("id", id);
  assertNoError(error, "Failed to update member");
  syncCaches(
    ["members_page", "rooms_page", "dashboard_page", "attendance_page", "fees_page", "command_index"],
    "members"
  );
}

export async function deleteMember(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("members").delete().eq("id", id);
  assertNoError(error, "Failed to delete member");
  syncCaches(
    ["members_page", "rooms_page", "dashboard_page", "attendance_page", "fees_page", "command_index"],
    "members"
  );
}

export async function deleteMembersBatch(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = requireSupabase();
  const { error } = await supabase.from("members").delete().in("id", ids);
  assertNoError(error, "Failed to delete members");
  syncCaches(
    ["members_page", "rooms_page", "dashboard_page", "attendance_page", "fees_page", "command_index"],
    "members"
  );
}
