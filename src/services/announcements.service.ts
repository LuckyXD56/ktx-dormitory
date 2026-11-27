"use client";

import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementScope,
} from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface AnnouncementInput {
  title: string;
  content: string;
  category: AnnouncementCategory;
  target_scope: AnnouncementScope;
  target_building_id?: string | null;
  target_room_id?: string | null;
  is_pinned?: boolean;
  published_at?: string;
  created_by?: string | null;
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "*, building:buildings(*), room:rooms(*), author:profiles(id, full_name, role)"
    )
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });
  assertNoError(error, "Failed to load announcements");
  return (data as Announcement[]) ?? [];
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("announcements").insert(input);
  assertNoError(error, "Failed to create announcement");
  syncCaches(["announcements_page", "dashboard_page", "alerts"], "announcements");
}

export async function updateAnnouncement(
  id: string,
  input: Partial<AnnouncementInput>
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("announcements")
    .update(input)
    .eq("id", id);
  assertNoError(error, "Failed to update announcement");
  syncCaches(["announcements_page", "dashboard_page", "alerts"], "announcements");
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  assertNoError(error, "Failed to delete announcement");
  syncCaches(["announcements_page", "dashboard_page", "alerts"], "announcements");
}
