-- RPC: get lead assignment counts for leads assigned BY admin-role users
-- Supports optional date range filter on lead created_at
CREATE OR REPLACE FUNCTION get_admin_assignment_summary(
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to   TIMESTAMPTZ DEFAULT NULL,
  p_admin_user_id UUID DEFAULT NULL  -- if set, only count leads assigned by this specific admin
)
RETURNS TABLE(user_id UUID, full_name TEXT, lead_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH admin_users AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND (p_admin_user_id IS NULL OR ur.user_id = p_admin_user_id)
  ),
  admin_assigned_leads AS (
    -- leads explicitly assigned by admin via activity log
    SELECT DISTINCT la.lead_id AS id
    FROM public.lead_activities la
    INNER JOIN admin_users au ON au.user_id = la.user_id
    WHERE lower(la.description) LIKE '%assigned to%'
      AND (p_date_from IS NULL OR la.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR la.created_at <= p_date_to)

    UNION

    -- leads created by admin with assigned_to already set
    SELECT l.id
    FROM public.leads l
    INNER JOIN admin_users au ON au.user_id = l.created_by
    WHERE l.assigned_to IS NOT NULL
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
  ),
  counts AS (
    SELECT l.assigned_to, COUNT(*) AS cnt
    FROM public.leads l
    INNER JOIN admin_assigned_leads al ON al.id = l.id
    WHERE l.assigned_to IS NOT NULL
    GROUP BY l.assigned_to
  )
  SELECT p.user_id, p.full_name::TEXT, COALESCE(c.cnt, 0) AS lead_count
  FROM public.profiles p
  LEFT JOIN counts c ON c.assigned_to = p.user_id
  ORDER BY lead_count DESC, p.full_name;
$$;
