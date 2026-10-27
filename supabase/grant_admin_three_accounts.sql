-- Make the three shared accounts admins with full data access. Safe to run more than once.
do $$
declare
  mail text;
  uid uuid;
begin
  foreach mail in array array['ravimonga@tenderexpert.com','associatesmk493@gmail.com','connect@mkassociatess.com'] loop
    select id into uid from auth.users where lower(email) = mail;
    if uid is null then
      raise notice 'Not found in auth.users: %', mail;
      continue;
    end if;
    insert into public.user_roles (user_id, role) values (uid, 'ceo') on conflict (user_id, role) do nothing;
    insert into public.user_roles (user_id, role) values (uid, 'admin') on conflict (user_id, role) do nothing;
    insert into public.profiles (user_id, full_name, email) values (uid, split_part(mail, '@', 1), mail)
      on conflict (user_id) do update set email = excluded.email;
  end loop;
end $$;

select u.email, array_agg(r.role) as roles
from auth.users u left join public.user_roles r on r.user_id = u.id
where lower(u.email) in ('ravimonga@tenderexpert.com','associatesmk493@gmail.com','connect@mkassociatess.com')
group by u.email;
