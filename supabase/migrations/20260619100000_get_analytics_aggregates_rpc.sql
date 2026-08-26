-- RPC: get_analytics_aggregates
-- Returns aggregated lead stats for the Overview tab in MeCA Analytics
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
      COALESCE(l.quoted_amount::numeric, 0) AS quoted_amount
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
      COUNT(*) FILTER (WHERE funnel_stage = 'order_won')             AS won,
      COUNT(*) FILTER (WHERE temperature  = 'hot')                   AS hot,
      COUNT(*) FILTER (WHERE temperature  = 'warm')                  AS warm,
      COUNT(*) FILTER (WHERE temperature  = 'cold')                  AS cold,
      SUM(order_amount)                                               AS total_sales,
      SUM(quoted_amount)                                              AS total_quoted,
      COUNT(*) FILTER (WHERE funnel_stage IN ('closure_order_1','order_won')) AS closed_count,
      COUNT(*) FILTER (WHERE funnel_stage = 'meetings_n_analysis')   AS meetings_count,
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
      COUNT(*) FILTER (WHERE funnel_stage = 'order_won') AS won,
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
