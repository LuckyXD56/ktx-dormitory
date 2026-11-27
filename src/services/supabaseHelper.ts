"use client";

import { createClient } from "@/lib/supabase/client";
import { emitDormSync, invalidateCache } from "@/lib/cache";

export function requireSupabase() {
  const supabase = createClient();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }
  return supabase;
}

export function assertNoError(
  error: { message: string } | null | undefined,
  fallbackMessage = "Operation failed"
): void {
  if (error) {
    throw new Error(error.message || fallbackMessage);
  }
}

export function syncCaches(cacheKeys: string[], syncTopic?: string): void {
  cacheKeys.forEach((key) => invalidateCache(key));
  emitDormSync(syncTopic);
}
