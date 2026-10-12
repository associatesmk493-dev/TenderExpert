-- Lead source event name, fund-flow cells and "Not interested" lost reason.
alter table public.b2g_leads
  add column if not exists event_name text,
  add column if not exists total_amount numeric(14,2) not null default 0,
  add column if not exists received_amount numeric(14,2) not null default 0;

-- Allow "not_interested" as a closing reason.
alter table public.b2g_leads drop constraint if exists b2g_leads_lost_reason_code_check;
alter table public.b2g_leads add constraint b2g_leads_lost_reason_code_check check (
  lost_reason_code is null or lost_reason_code in
    ('not_interested','price','competitor','budget_freeze','no_response','timeline','scope_mismatch','project_cancelled','lost_to_incumbent','other')
);

-- Vendor Registration is now CPWD Class Registration.
update public.b2g_leads
set service_interest = array_replace(service_interest, 'Vendor Registration', 'CPWD Class Registration')
where 'Vendor Registration' = any(service_interest);
