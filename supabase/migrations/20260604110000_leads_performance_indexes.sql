-- Performance indexes for leads table (30k+ rows)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_assigned_to      ON public.leads (assigned_to);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_funnel_stage     ON public.leads (funnel_stage);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at       ON public.leads (created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_last_call_outcome ON public.leads (last_call_outcome);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_temperature       ON public.leads (temperature);

-- Composite index covers the most common query: non-admin user + stage filter + date sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_assigned_stage_created
  ON public.leads (assigned_to, funnel_stage, created_at DESC);

-- Composite index for admin unassigned query
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_unassigned_created
  ON public.leads (assigned_to, created_at DESC)
  WHERE assigned_to IS NULL;

-- Replace 11 separate COUNT queries with one single-pass function
CREATE OR REPLACE FUNCTION get_lead_stage_counts(p_user_id UUID, p_is_admin BOOLEAN)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'all',            COUNT(*) FILTER (WHERE last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lead_capture',   COUNT(*) FILTER (WHERE funnel_stage = 'lead_capture'    AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'qualification',  COUNT(*) FILTER (WHERE funnel_stage = 'qualification'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'need_analysis',  COUNT(*) FILTER (WHERE funnel_stage = 'need_analysis'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'proposal',       COUNT(*) FILTER (WHERE funnel_stage = 'proposal'        AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'negotiation',    COUNT(*) FILTER (WHERE funnel_stage = 'negotiation'     AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'closure_order_1',COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1' AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lost_rejected',  COUNT(*) FILTER (WHERE funnel_stage = 'lost_rejected'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'post_sale',      COUNT(*) FILTER (WHERE funnel_stage NOT IN ('closure_order_1','lost_rejected') AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'unassigned',     COUNT(*) FILTER (WHERE assigned_to IS NULL              AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'not_interested', COUNT(*) FILTER (WHERE last_call_outcome = 'not_interested')
  )
  FROM public.leads
  WHERE p_is_admin OR assigned_to = p_user_id
$$;
