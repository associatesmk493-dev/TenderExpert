-- Server-side aggregation for Sales Person Summary (avoids 1000-row client limit)
CREATE OR REPLACE FUNCTION get_salesperson_summary()
RETURNS TABLE (
  assigned_to   uuid,
  inquiry       bigint,
  won           bigint,
  lost          bigint,
  active        bigint,
  quote_amt     numeric,
  won_amt       numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    assigned_to,
    COUNT(*)                                                                         AS inquiry,
    COUNT(*) FILTER (WHERE funnel_stage = 'closure_order_1')                        AS won,
    COUNT(*) FILTER (WHERE funnel_stage = 'lost_rejected')                          AS lost,
    COUNT(*) FILTER (WHERE funnel_stage IN ('lead_capture','qualification','proposal','negotiation')) AS active,
    COALESCE(SUM(quoted_amount) FILTER (
      WHERE funnel_stage IN ('lead_capture','qualification','proposal','negotiation')
    ), 0)                                                                            AS quote_amt,
    COALESCE(SUM(
      ROUND(COALESCE(advance_amount,0) + COALESCE(before_delivery_amount,0) + COALESCE(after_delivery_amount,0))
    ) FILTER (WHERE funnel_stage = 'closure_order_1'), 0)                           AS won_amt
  FROM public.leads
  WHERE assigned_to IS NOT NULL
  GROUP BY assigned_to
$$;

NOTIFY pgrst, 'reload schema';
