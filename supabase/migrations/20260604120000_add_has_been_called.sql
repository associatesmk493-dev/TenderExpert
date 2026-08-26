-- Add has_been_called flag to leads for "New Leads" filter
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_been_called boolean NOT NULL DEFAULT false;

-- Backfill: mark leads that already have a call activity
UPDATE public.leads l
SET has_been_called = true
WHERE EXISTS (
  SELECT 1 FROM public.lead_activities la
  WHERE la.lead_id = l.id AND la.activity_type = 'call'
);

-- Trigger to auto-set has_been_called when a call activity is logged
CREATE OR REPLACE FUNCTION mark_lead_called()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activity_type = 'call' THEN
    UPDATE public.leads SET has_been_called = true WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_called ON public.lead_activities;
CREATE TRIGGER trg_lead_called
AFTER INSERT ON public.lead_activities
FOR EACH ROW EXECUTE FUNCTION mark_lead_called();

-- Update stage counts to include new_leads count
CREATE OR REPLACE FUNCTION get_lead_stage_counts(p_user_id UUID, p_is_admin BOOLEAN)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'all',            COUNT(*) FILTER (WHERE last_call_outcome IS DISTINCT FROM 'not_interested'),
    'new_leads',      COUNT(*) FILTER (WHERE has_been_called = false AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lead_capture',   COUNT(*) FILTER (WHERE funnel_stage = 'lead_capture'    AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'qualification',  COUNT(*) FILTER (WHERE funnel_stage = 'qualification'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'need_analysis',  COUNT(*) FILTER (WHERE funnel_stage = 'need_analysis'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'proposal',       COUNT(*) FILTER (WHERE funnel_stage = 'proposal'        AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'negotiation',    COUNT(*) FILTER (WHERE funnel_stage = 'negotiation'     AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'closure_order_1',COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1' AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lost_rejected',  COUNT(*) FILTER (WHERE funnel_stage = 'lost_rejected'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'post_sale',      COUNT(*) FILTER (WHERE funnel_stage NOT IN ('closure_order_1','lost_rejected') AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'unassigned',     COUNT(*) FILTER (WHERE assigned_to IS NULL              AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'not_interested', COUNT(*) FILTER (WHERE last_call_outcome = 'not_interested'),
    'rnr',            COUNT(*) FILTER (WHERE last_call_outcome = 'not_picked_up')
  )
  FROM public.leads
  WHERE p_is_admin OR assigned_to = p_user_id
$$;

-- Index for updated_at sort (used as primary sort order for lead list)
CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON public.leads (updated_at DESC);

NOTIFY pgrst, 'reload schema';
