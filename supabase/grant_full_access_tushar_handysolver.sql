-- Full b2g CRM access for tushar.handysolver@gmail.com.
-- Run after the user has signed up and exists in auth.users.

do $$
declare
  target_uid uuid;
  table_name text;
begin
  select id into target_uid
  from auth.users
  where lower(email) = 'tushar.handysolver@gmail.com'
  limit 1;

  if target_uid is null then
    raise exception 'User tushar.handysolver@gmail.com does not exist in auth.users. Ask the user to sign up first.';
  end if;

  foreach table_name in array array[
    'b2g_leads','b2g_activities','b2g_projects','b2g_payment_milestones',
    'b2g_tasks','b2g_proposals','b2g_notifications','communication_drafts',
    'tender_opportunities','b2g_documents','companies','b2g_payment_receipts',
    'b2g_expenses','b2g_stage_history','b2g_ai_insights','b2g_client_meetings'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', 'tushar_handysolver_full_access_' || table_name, table_name);
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = %L::uuid) with check ((select auth.uid()) = %L::uuid)',
        'tushar_handysolver_full_access_' || table_name,
        table_name,
        target_uid,
        target_uid
      );
      execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    end if;
  end loop;

  if to_regclass('public.user_roles') is not null then
    execute format(
      'insert into public.user_roles(user_id,role) values (%L::uuid,''ceo'') on conflict (user_id,role) do nothing',
      target_uid
    );
  end if;

  raise notice 'Full CRM access granted to tushar.handysolver@gmail.com (%)', target_uid;
end $$;

-- Verification
select id,email,last_sign_in_at
from auth.users
where lower(email)='tushar.handysolver@gmail.com';

select policyname,tablename,cmd
from pg_policies
where schemaname='public'
  and policyname like 'tushar_handysolver_full_access_%'
order by tablename;

