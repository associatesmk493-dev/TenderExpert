-- ============================================================================
-- Grant full-data access to tusharbali855@gmail.com
--
-- Run in Supabase SQL Editor AFTER this user has signed up at least once
-- (they must exist in auth.users). Re-running is harmless.
--
-- Note: the live TenderExpert tables (b2g_leads, b2g_projects,
-- b2g_payment_milestones, b2g_tasks, ...) already let every authenticated
-- user read all rows via RLS, so this user will see everything there just by
-- logging in. This script additionally grants the 'ceo' + 'admin' roles so
-- the legacy leads/lead_orders tables and every is_admin()-gated RPC also
-- return all rows.
-- ============================================================================

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = 'tusharbali855@gmail.com';

  if uid is null then
    raise notice 'User tusharbali855@gmail.com not found in auth.users. Ask them to sign up first, then re-run.';
    return;
  end if;

  -- Roles (unique on user_id, role)
  insert into public.user_roles (user_id, role) values (uid, 'ceo')
    on conflict (user_id, role) do nothing;
  insert into public.user_roles (user_id, role) values (uid, 'admin')
    on conflict (user_id, role) do nothing;

  -- Make sure a profile row exists and carries the email
  insert into public.profiles (user_id, full_name, email)
    values (uid, 'Tushar Bali', 'tusharbali855@gmail.com')
    on conflict (user_id) do update set email = excluded.email;

  raise notice 'Full access granted to % (%).', 'tusharbali855@gmail.com', uid;
end $$;

-- Verify
-- select u.email, array_agg(r.role) as roles
-- from auth.users u left join public.user_roles r on r.user_id = u.id
-- where lower(u.email) = 'tusharbali855@gmail.com'
-- group by u.email;
