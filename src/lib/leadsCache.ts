import type { Lead } from '@/types/crm';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function cacheKey(userId: string, suffix: string) {
  return `kitchn_cache_${userId}_${suffix}`;
}

function write<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() } satisfies CacheEntry<T>));
  } catch { /* quota exceeded — ignore */ }
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
    return entry.data;
  } catch { return null; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const LeadsCache = {
  saveLeads(userId: string, leads: Lead[], total: number) {
    write(cacheKey(userId, 'leads_p1'), { leads, total });
  },
  getLeads(userId: string): { leads: Lead[]; total: number } | null {
    return read(cacheKey(userId, 'leads_p1'));
  },

  saveCounts(userId: string, counts: Record<string, number>) {
    write(cacheKey(userId, 'counts'), counts);
  },
  getCounts(userId: string): Record<string, number> | null {
    return read(cacheKey(userId, 'counts'));
  },

  saveMeta(userId: string, meta: { showrooms: any[]; profiles: any[] }) {
    write(cacheKey(userId, 'meta'), meta);
  },
  getMeta(userId: string): { showrooms: any[]; profiles: any[] } | null {
    return read(cacheKey(userId, 'meta'));
  },

  clear(userId: string) {
    ['leads_p1', 'counts', 'meta'].forEach((s) =>
      localStorage.removeItem(cacheKey(userId, s))
    );
  },
};
