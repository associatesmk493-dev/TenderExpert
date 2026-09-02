-- Every newly created opportunity gets a visible next-day dashboard action.
-- Additive and safe for existing leads: historical records are not backfilled.

create or replace function public.schedule_new_b2g_lead_followup()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  followup_at timestamptz;
begin
  followup_at := coalesce(
    new.next_follow_up_at,
    (
      date_trunc('day', new.created_at at time zone 'Asia/Kolkata')
      + interval '1 day 10 hours'
    ) at time zone 'Asia/Kolkata'
  );

  if new.next_follow_up_at is null then
    update public.b2g_leads
       set next_follow_up_at = followup_at
     where id = new.id;
  end if;

  insert into public.b2g_tasks(
    lead_id,
    title,
    description,
    task_type,
    priority,
    due_at,
    assigned_to,
    created_by
  ) values (
    new.id,
    'First follow-up: ' || new.organization_name,
    'Review the new lead, contact the client and record the outcome.',
    'follow_up',
    case when new.heat = 'hot' then 'high' else 'medium' end,
    followup_at,
    new.assigned_to,
    coalesce(new.created_by, (select auth.uid()))
  );

  return new;
end;
$$;

drop trigger if exists b2g_new_lead_next_day_followup on public.b2g_leads;
create trigger b2g_new_lead_next_day_followup
  after insert on public.b2g_leads
  for each row execute function public.schedule_new_b2g_lead_followup();

