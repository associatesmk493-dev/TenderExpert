# CRM growth engine deployment

The repository now contains the Phase 1–4 implementation. Database features remain unavailable in production until the migrations and Edge Function are deployed.

## Deploy in order

1. Apply `supabase/migrations/20260831120000_companies.sql`.
2. Apply `supabase/migrations/20260831150000_growth_engine_phases_1_4.sql`.
3. Deploy `supabase/functions/tenderexpert-ai` and configure `OPENAI_API_KEY` and `OPENAI_MODEL` as server-side secrets.
4. Apply `supabase/grant_full_access_tusharbali.sql` after the user has signed up.
5. Deploy the frontend and open `/growth`.

Supabase Cron schedules three jobs during the growth-engine migration:

- `tenderexpert-growth-automation` every 15 minutes.
- `tenderexpert-lead-scoring-nightly` nightly.
- `tenderexpert-insights-daily` daily.

## Production verification

Run these in the Supabase SQL editor after deployment:

```sql
select count(*) companies from public.companies;
select count(*) leads, count(company_id) linked from public.b2g_leads;
select public.run_b2g_automations();
select public.refresh_b2g_lead_scores();
select public.refresh_b2g_rule_based_insights();
select jobname, schedule, active from cron.job
where jobname like 'tenderexpert-%' order by jobname;
select * from public.b2g_project_pnl limit 10;
select * from public.b2g_ageing_receivables limit 10;
select * from public.b2g_cashflow_forecast order by forecast_month;
```

AI-generated communication remains a draft and insights remain suggestions until a user approves them.
