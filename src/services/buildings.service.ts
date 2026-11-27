"use client";

import type { Building, GenderPolicy } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export interface BuildingInput {
  code: string;
  name: string;
  total_floors: number;
  gender_policy: GenderPolicy;
  description?: string | null;
}

export async function listBuildings(): Promise<Building[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .order("code");
  assertNoError(error, "Failed to load buildings");
  return (data as Building[]) ?? [];
}

export async function createBuilding(input: BuildingInput): Promise<Building> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("buildings")
    .insert({
      code: input.code.trim(),
      name: input.name.trim(),
      total_floors: input.total_floors,
      gender_policy: input.gender_policy,
      description: input.description?.trim() ?? "",
    })
    .select("*")
    .single();
  assertNoError(error, "Failed to create building");
  syncCaches(["rooms_page", "members_page", "dashboard_page", "command_index"], "buildings");
  return data as Building;
}

export async function updateBuilding(
  id: string,
  input: Partial<BuildingInput>
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("buildings")
    .update({
      ...(input.code !== undefined ? { code: input.code.trim() } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.total_floors !== undefined ? { total_floors: input.total_floors } : {}),
      ...(input.gender_policy !== undefined ? { gender_policy: input.gender_policy } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() ?? "" } : {}),
    })
    .eq("id", id);
  assertNoError(error, "Failed to update building");
  syncCaches(["rooms_page", "members_page", "dashboard_page", "command_index"], "buildings");
}

export async function deleteBuilding(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  assertNoError(error, "Failed to delete building");
  syncCaches(["rooms_page", "members_page", "dashboard_page", "command_index"], "buildings");
}
