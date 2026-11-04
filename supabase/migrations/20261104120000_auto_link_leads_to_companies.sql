-- Every lead is linked to a company record automatically (found by name, or created), so the Clients page
-- and Client 360 always show new leads too. Also links the leads that are still unlinked today.

create or replace function public.link_lead_to_company()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cid uuid;
begin
  if new.company_id is null and coalesce(btrim(new.organization_name), '') <> '' then
    insert into public.companies (name, phone, email, website, industry, city, state, created_by)
    values (
      btrim(new.organization_name),
      nullif(btrim(new.phone), ''),
      nullif(btrim(new.email), ''),
      nullif(btrim(new.website), ''),
      nullif(btrim(new.industry), ''),
      nullif(btrim(new.city), ''),
      nullif(btrim(new.state), ''),
      new.created_by
    )
    on conflict (normalized_name) do nothing;

    select id into cid from public.companies
    where normalized_name = public.normalize_company_name(new.organization_name);
    new.company_id := cid;
  end if;
  return new;
end $$;

drop trigger if exists b2g_lead_company_link on public.b2g_leads;
create trigger b2g_lead_company_link
  before insert or update of organization_name on public.b2g_leads
  for each row execute function public.link_lead_to_company();

-- Link the leads that are not linked yet.
insert into public.companies (name, phone, email, website, industry, city, state, created_by)
select distinct on (public.normalize_company_name(l.organization_name))
       btrim(l.organization_name), nullif(btrim(l.phone), ''), nullif(btrim(l.email), ''), nullif(btrim(l.website), ''),
       nullif(btrim(l.industry), ''), nullif(btrim(l.city), ''), nullif(btrim(l.state), ''), l.created_by
from public.b2g_leads l
where l.company_id is null and coalesce(btrim(l.organization_name), '') <> ''
order by public.normalize_company_name(l.organization_name), l.updated_at desc nulls last
on conflict (normalized_name) do nothing;

update public.b2g_leads l
set company_id = c.id
from public.companies c
where l.company_id is null
  and coalesce(btrim(l.organization_name), '') <> ''
  and c.normalized_name = public.normalize_company_name(l.organization_name);

notify pgrst, 'reload schema';
