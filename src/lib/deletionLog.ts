import { supabase } from '@/integrations/supabase/client';

// Best-effort record of why something was deleted. Never blocks the deletion itself
// (e.g. if the deletion_log table has not been created yet).
export async function logDeletion(entity: string, entityName: string, reason: string, leadId?: string | null) {
  try {
    await supabase.from('deletion_log' as never).insert({ entity, entity_name: entityName.slice(0, 200), reason: reason.slice(0, 1000), lead_id: leadId ?? null } as never);
  } catch {
    /* ignore */
  }
}
