-- Team-wide monthly AI usage, for the spend cap. Returns token totals only (no content, no user ids).
-- SECURITY DEFINER because ai_usage_log rows are owner-only under RLS.
create or replace function public.ai_month_usage()
returns table(input_tokens bigint, output_tokens bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(sum(input_tokens), 0)::bigint, coalesce(sum(output_tokens), 0)::bigint
  from public.ai_usage_log
  where created_at >= date_trunc('month', now())
    and (select auth.uid()) is not null;
$$;

revoke all on function public.ai_month_usage() from public, anon;
grant execute on function public.ai_month_usage() to authenticated;
