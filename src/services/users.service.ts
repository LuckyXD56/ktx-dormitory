"use client";

import type { Language, Profile, UserRole } from "@/types/database";
import { assertNoError, requireSupabase, syncCaches } from "./supabaseHelper";

export async function listProfiles(): Promise<Profile[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  assertNoError(error, "Failed to load user profiles");
  return (data as Profile[]) ?? [];
}

export async function updateProfileRole(
  userId: string,
  role: UserRole
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  assertNoError(error, "Failed to update role");
  syncCaches([], "profiles");
}

export async function updateProfileActive(
  userId: string,
  isActive: boolean
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  assertNoError(error, "Failed to update account status");
  syncCaches([], "profiles");
}

export async function updateSelfProfile(
  userId: string,
  input: {
    full_name: string;
    phone: string;
    preferred_language: Language;
  }
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      preferred_language: input.preferred_language,
    })
    .eq("id", userId);
  assertNoError(error, "Failed to update profile");
  syncCaches([], "profiles");
}

export async function updateOwnPassword(newPassword: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  assertNoError(error, "Failed to update password");
}

export async function createStaffAccount(payload: {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone: string;
  preferred_language: Language;
}): Promise<void> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to create account");
  }
  syncCaches([], "profiles");
}

export async function deleteStaffAccount(userId: string): Promise<void> {
  const res = await fetch("/api/users", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Failed to delete account");
  }
  syncCaches([], "profiles");
}
