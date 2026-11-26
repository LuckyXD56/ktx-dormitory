"use client";

const memCache = new Map<string, { data: unknown; ts: number }>();

export function getCached<T>(key: string, maxAgeMs = 300_000): T | null {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.ts < maxAgeMs) {
    return mem.data as T;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(`dorm_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; ts: number };
        if (Date.now() - parsed.ts < maxAgeMs) {
          memCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }
  return null;
}

export function isCacheFresh(key: string, freshMs = 15_000): boolean {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.ts < freshMs) {
    return true;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(`dorm_cache_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number };
        return Date.now() - parsed.ts < freshMs;
      }
    } catch {
      // Ignore
    }
  }
  return false;
}

export function setCached<T>(key: string, data: T): void {
  const entry = { data, ts: Date.now() };
  memCache.set(key, entry);
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(`dorm_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Ignore quota errors
    }
  }
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memCache.clear();
    if (typeof window !== "undefined") {
      Object.keys(window.sessionStorage)
        .filter((k) => k.startsWith("dorm_cache_"))
        .forEach((k) => window.sessionStorage.removeItem(k));
    }
    return;
  }
  Array.from(memCache.keys())
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => memCache.delete(k));
  if (typeof window !== "undefined") {
    Object.keys(window.sessionStorage)
      .filter((k) => k.startsWith(`dorm_cache_${prefix}`))
      .forEach((k) => window.sessionStorage.removeItem(k));
  }
}

export function emitAlertsRefresh(): void {
  invalidateCache("alerts");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dorm:refresh-alerts"));
  }
}
