/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';

// The date shown on a lead (lists, dashboard, reminders) is always the nearest pending follow-up task.
// Without this it held whichever follow-up was added last, and never changed when one was completed.
export async function syncNextFollowUp(leadId: string | null | undefined) {
  if (!leadId) return null;
  const { data } = await supabase
    .from('b2g_tasks' as any)
    .select('due_at')
    .eq('lead_id', leadId)
    .eq('task_type', 'follow_up')
    .is('completed_at', null)
    .order('due_at', { ascending: true })
    .limit(1);
  const next: string | null = (data as any[])?.[0]?.due_at ?? null;
  if (next) {
    await supabase.from('b2g_leads' as any).update({ next_follow_up_at: next }).eq('id', leadId);
    return next;
  }
  // Nothing pending: keep a manually set future date, clear one that has already passed.
  const { data: lead } = await supabase.from('b2g_leads' as any).select('next_follow_up_at').eq('id', leadId).maybeSingle();
  const current = (lead as any)?.next_follow_up_at as string | null | undefined;
  if (current && new Date(current).getTime() <= Date.now()) {
    await supabase.from('b2g_leads' as any).update({ next_follow_up_at: null }).eq('id', leadId);
    return null;
  }
  return current ?? null;
}

// Same, starting from a task id (used where only the task is at hand).
export async function syncNextFollowUpForTask(taskId: string) {
  const { data } = await supabase.from('b2g_tasks' as any).select('lead_id').eq('id', taskId).maybeSingle();
  await syncNextFollowUp((data as any)?.lead_id);
}
