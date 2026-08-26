-- Update get_lead_stage_counts to include catalog_send count
-- Must be a separate migration from the ALTER TYPE (enum values need to be committed first)
CREATE OR REPLACE FUNCTION get_lead_stage_counts(p_user_id UUID, p_is_admin BOOLEAN)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'all',            COUNT(*) FILTER (WHERE last_call_outcome IS DISTINCT FROM 'not_interested'),
    'new_lead',       COUNT(*) FILTER (WHERE funnel_stage = 'new_lead'        AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lead',           COUNT(*) FILTER (WHERE funnel_stage = 'lead_capture'    AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lead_capture',   COUNT(*) FILTER (WHERE funnel_stage = 'lead_capture'    AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'qualification',  COUNT(*) FILTER (WHERE funnel_stage = 'qualification'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'need_analysis',  COUNT(*) FILTER (WHERE funnel_stage = 'need_analysis'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'proposal',       COUNT(*) FILTER (WHERE funnel_stage = 'proposal'        AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'catalog_send',   COUNT(*) FILTER (WHERE funnel_stage = 'catalog_send'    AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'negotiation',    COUNT(*) FILTER (WHERE funnel_stage = 'negotiation'     AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'closure_order_1',COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1' AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lost_rejected',  COUNT(*) FILTER (WHERE funnel_stage = 'lost_rejected'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'post_sale',      COUNT(*) FILTER (WHERE funnel_stage NOT IN ('closure_order_1','lost_rejected','rnr') AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'unassigned',     COUNT(*) FILTER (WHERE assigned_to IS NULL              AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'not_interested', COUNT(*) FILTER (WHERE last_call_outcome = 'not_interested'),
    'rnr',            COUNT(*) FILTER (WHERE funnel_stage = 'rnr' OR last_call_outcome = 'not_picked_up')
  )
  FROM public.leads
  WHERE p_is_admin OR assigned_to = p_user_id
$$;
