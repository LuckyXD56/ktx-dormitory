"use client";

import type { Room, RoomStatus } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface RoomInput {
  building_id: string;
  room_number: string;
  floor: number;
  capacity: number;
  monthly_fee: number;
  status?: RoomStatus;
  notes?: string | null;
}

export async function listRooms(): Promise<Room[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("rooms")
    .select("*, building:buildings(*)")
    .order("room_number");
  assertNoError(error, "Failed to load rooms");
  return (data as Room[]) ?? [];
}

export async function createRoom(input: RoomInput): Promise<Room> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      building_id: input.building_id,
      room_number: input.room_number.trim(),
      floor: input.floor,
      capacity: input.capacity,
      monthly_fee: input.monthly_fee,
      status: input.status ?? "available",
      notes: input.notes?.trim() ?? "",
    })
    .select("*, building:buildings(*)")
    .single();
  assertNoError(error, "Failed to create room");
  syncCaches(["rooms_page", "members_page", "dashboard_page", "command_index"], "rooms");
  return data as Room;
}

export async function updateRoom(
  id: string,
  input: Partial<RoomInput>
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("rooms")
    .update({
      ...(input.building_id !== undefined ? { building_id: input.building_id } : {}),
      ...(input.room_number !== undefined ? { room_number: input.room_number.trim() } : {}),
      ...(input.floor !== undefined ? { floor: input.floor } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.monthly_fee !== undefined ? { monthly_fee: input.monthly_fee } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() ?? "" } : {}),
    })
    .eq("id", id);
  assertNoError(error, "Failed to update room");
  syncCaches(["rooms_page", "members_page", "dashboard_page", "command_index"], "rooms");
}

export async function setRoomStatus(id: string, status: RoomStatus): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("rooms")
    .update({ status })
    .eq("id", id);
  assertNoError(error, "Failed to update room status");
  syncCaches(["rooms_page", "dashboard_page"], "rooms");
}

export async function deleteRoom(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  assertNoError(error, "Failed to delete room");
  syncCaches(["rooms_page", "members_page", "dashboard_page", "command_index"], "rooms");
}
