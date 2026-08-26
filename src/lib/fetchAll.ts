import { supabase } from '@/integrations/supabase/client';

type SupabaseTable = Parameters<typeof supabase.from>[0];

/**
 * Fetches ALL rows from a Supabase table/query by paginating in chunks.
 * Supabase caps single requests at 1000 rows — this bypasses that limit.
 */
export async function fetchAll<T = Record<string, unknown>>(
  builder: () => ReturnType<ReturnType<typeof supabase.from>['select']>,
  pageSize = 1000,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (builder() as any).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return results;
}
