-- Add per-funnel-stage revenue totals alongside the existing counts, so the
-- Sales Summary tab can show "how much business is sitting at this stage"
-- (quoted_amount for pipeline stages, closed_amount for won/delivered/post_sale).

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
    'delivered',      COUNT(*) FILTER (WHERE funnel_stage = 'delivered'       AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'lost_rejected',  COUNT(*) FILTER (WHERE funnel_stage = 'lost_rejected'   AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'post_sale',      COUNT(*) FILTER (WHERE funnel_stage NOT IN ('closure_order_1','lost_rejected','rnr') AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'unassigned',     COUNT(*) FILTER (WHERE assigned_to IS NULL              AND last_call_outcome IS DISTINCT FROM 'not_interested'),
    'not_interested', COUNT(*) FILTER (WHERE last_call_outcome = 'not_interested'),
    'rnr',            COUNT(*) FILTER (WHERE funnel_stage = 'rnr' OR last_call_outcome = 'not_picked_up'),
    'amounts', jsonb_build_object(
      'lead_capture',    COALESCE(SUM(quoted_amount) FILTER (WHERE funnel_stage = 'lead_capture'    AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'qualification',   COALESCE(SUM(quoted_amount) FILTER (WHERE funnel_stage = 'qualification'   AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'need_analysis',   COALESCE(SUM(quoted_amount) FILTER (WHERE funnel_stage = 'need_analysis'   AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'proposal',        COALESCE(SUM(quoted_amount) FILTER (WHERE funnel_stage = 'proposal'        AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'catalog_send',    COALESCE(SUM(quoted_amount) FILTER (WHERE funnel_stage = 'catalog_send'    AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'negotiation',     COALESCE(SUM(quoted_amount) FILTER (WHERE funnel_stage = 'negotiation'     AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'closure_order_1', COALESCE(SUM(closed_amount) FILTER (WHERE funnel_stage = 'closure_order_1' AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'delivered',       COALESCE(SUM(closed_amount) FILTER (WHERE funnel_stage = 'delivered'       AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0),
      'post_sale',       COALESCE(SUM(closed_amount) FILTER (WHERE funnel_stage NOT IN ('closure_order_1','lost_rejected','rnr') AND last_call_outcome IS DISTINCT FROM 'not_interested'), 0)
    )
  )
  FROM public.leads
  WHERE p_is_admin OR assigned_to = p_user_id
$$;

CREATE OR REPLACE FUNCTION get_analytics_aggregates(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to   TIMESTAMPTZ DEFAULT NULL,
  p_user_id   UUID        DEFAULT NULL  -- NULL = all users (admin/manager view)
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  WITH base AS (
    SELECT
      l.id,
      l.assigned_to,
      l.showroom_id,
      l.funnel_stage,
      l.temperature,
      l.source_portal,
      l.business_type,
      l.lead_type,
      l.region,
      l.last_call_outcome,
      COALESCE(ROUND(COALESCE(l.advance_amount,0) + COALESCE(l.before_delivery_amount,0) + COALESCE(l.after_delivery_amount,0)), 0) AS order_amount,
      COALESCE(l.quoted_amount::numeric, 0) AS quoted_amount,
      COALESCE(l.closed_amount::numeric, 0) AS closed_amount
    FROM public.leads l
    WHERE
      (p_user_id   IS NULL OR l.assigned_to = p_user_id)
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
      AND l.customer_name NOT ILIKE '%spam%'
      AND l.customer_name NOT ILIKE '%unknown%'
      AND l.customer_name NOT ILIKE '%airtel warning%'
      AND l.customer_name NOT ILIKE '%suspected%'
  ),
  funnel_agg AS (
    SELECT funnel_stage AS k, COUNT(*) AS cnt
    FROM base WHERE funnel_stage IS NOT NULL
    GROUP BY funnel_stage
  ),
  -- Revenue sitting at each stage: quoted_amount for pipeline stages, actual
  -- closed_amount for won/delivered/post_sale (what was really realized).
  funnel_amount_agg AS (
    SELECT funnel_stage AS k,
      SUM(CASE WHEN funnel_stage IN ('closure_order_1','delivered','post_sale')
                THEN closed_amount ELSE quoted_amount END) AS amt
    FROM base WHERE funnel_stage IS NOT NULL
    GROUP BY funnel_stage
  ),
  source_agg AS (
    SELECT source_portal AS k, COUNT(*) AS cnt
    FROM base WHERE source_portal IS NOT NULL
    GROUP BY source_portal
  ),
  business_agg AS (
    SELECT business_type AS k, COUNT(*) AS cnt
    FROM base WHERE business_type IS NOT NULL
    GROUP BY business_type
  ),
  region_agg AS (
    SELECT region AS k, COUNT(*) AS cnt
    FROM base WHERE region IS NOT NULL
    GROUP BY region
  ),
  lead_type_agg AS (
    SELECT lead_type AS k, COUNT(*) AS cnt
    FROM base WHERE lead_type IS NOT NULL
    GROUP BY lead_type
  ),
  team_agg AS (
    SELECT
      assigned_to,
      COUNT(*)                                                        AS total,
      COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1')       AS won,
      COUNT(*) FILTER (WHERE temperature  = 'hot')                   AS hot,
      COUNT(*) FILTER (WHERE temperature  = 'warm')                  AS warm,
      COUNT(*) FILTER (WHERE temperature  = 'cold')                  AS cold,
      SUM(order_amount)                                               AS total_sales,
      SUM(quoted_amount)                                              AS total_quoted,
      COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1')       AS closed_count,
      COUNT(*) FILTER (WHERE funnel_stage = 'need_analysis')         AS meetings_count,
      jsonb_object_agg(funnel_stage, fs_cnt) FILTER (WHERE funnel_stage IS NOT NULL) AS stages
    FROM (
      SELECT assigned_to, funnel_stage, temperature, order_amount, quoted_amount,
             COUNT(*) OVER (PARTITION BY assigned_to, funnel_stage) AS fs_cnt
      FROM base
    ) sub
    WHERE assigned_to IS NOT NULL
    GROUP BY assigned_to
  ),
  showroom_agg AS (
    SELECT
      showroom_id,
      COUNT(*)                                          AS total,
      COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1') AS won,
      jsonb_object_agg(funnel_stage, fs_cnt) FILTER (WHERE funnel_stage IS NOT NULL) AS stages
    FROM (
      SELECT showroom_id, funnel_stage,
             COUNT(*) OVER (PARTITION BY showroom_id, funnel_stage) AS fs_cnt
      FROM base
    ) sub
    WHERE showroom_id IS NOT NULL
    GROUP BY showroom_id
  )
  SELECT json_build_object(
    'total',         (SELECT COUNT(*) FROM base),
    'funnel',        COALESCE((SELECT json_object_agg(k, cnt) FROM funnel_agg), '{}'),
    'funnel_amount', COALESCE((SELECT json_object_agg(k, amt) FROM funnel_amount_agg), '{}'),
    'source',        COALESCE((SELECT json_object_agg(k, cnt) FROM source_agg), '{}'),
    'business_type', COALESCE((SELECT json_object_agg(k, cnt) FROM business_agg), '{}'),
    'region',        COALESCE((SELECT json_object_agg(k, cnt) FROM region_agg), '{}'),
    'lead_type',     COALESCE((SELECT json_object_agg(k, cnt) FROM lead_type_agg), '{}'),
    'team',          COALESCE((SELECT json_agg(row_to_json(t)) FROM (
                       SELECT assigned_to, total, won, hot, warm, cold,
                              total_sales, total_quoted, closed_count, meetings_count,
                              COALESCE(stages, '{}'::jsonb) AS stages
                       FROM team_agg
                     ) t), '[]'),
    'showrooms',     COALESCE((SELECT json_agg(row_to_json(s)) FROM (
                       SELECT showroom_id, total, won,
                              COALESCE(stages, '{}'::jsonb) AS stages
                       FROM showroom_agg
                     ) s), '[]')
  ) INTO v_result;

  RETURN v_result;
END;
$$;
