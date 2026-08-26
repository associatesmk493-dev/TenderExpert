-- TenderExpert Phase 1 completion: proposals, tasks, integrations, notifications and storage.

create table if not exists public.b2g_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.b2g_leads(id) on delete cascade,
  title text not null, description text, task_type text not null default 'follow_up'
    check (task_type in ('follow_up','call','meeting','email','whatsapp','document','payment','tender','other')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_at timestamptz not null, assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  completed_at timestamptz, escalation_level smallint not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.proposal_templates (
  id uuid primary key default gen_random_uuid(), name text not null unique, pipeline public.b2g_pipeline,
  subject_template text not null, body_template text not null, terms_template text,
  is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.b2g_proposals (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  template_id uuid references public.proposal_templates(id) on delete set null, proposal_number text not null unique,
  subject text not null, scope text not null, commercial_terms text, payment_model public.payment_model not null,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0), gst_rate numeric(5,2) not null default 18,
  gst_amount numeric(14,2) generated always as (round(subtotal * gst_rate / 100, 2)) stored,
  status text not null default 'draft' check (status in ('draft','sent','viewed','accepted','rejected','expired')),
  valid_until date, sent_at timestamptz, accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.b2g_notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  lead_id uuid references public.b2g_leads(id) on delete cascade, task_id uuid references public.b2g_tasks(id) on delete cascade,
  notification_type text not null, title text not null, message text, severity text not null default 'info'
    check (severity in ('info','warning','urgent','success')), read_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(), provider text not null unique
    check (provider in ('whatsapp','email','website','calendar','openai')),
  enabled boolean not null default false, config jsonb not null default '{}',
  webhook_secret_hint text, last_sync_at timestamptz, last_error text,
  updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now()
);

create table if not exists public.communication_drafts (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')), purpose text not null,
  subject text, body text not null, status text not null default 'draft' check (status in ('draft','approved','sent','discarded')),
  generated_by text not null default 'template', created_by uuid references auth.users(id) on delete set null default auth.uid(),
  sent_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists b2g_tasks_due_open_idx on public.b2g_tasks(due_at, priority) where completed_at is null;
create index if not exists proposals_lead_status_idx on public.b2g_proposals(lead_id, status);
create index if not exists notifications_user_unread_idx on public.b2g_notifications(user_id, created_at desc) where read_at is null;
create index if not exists communication_lead_created_idx on public.communication_drafts(lead_id, created_at desc);

drop trigger if exists b2g_tasks_updated_at on public.b2g_tasks;
create trigger b2g_tasks_updated_at before update on public.b2g_tasks for each row execute function public.set_updated_at();
drop trigger if exists proposal_templates_updated_at on public.proposal_templates;
create trigger proposal_templates_updated_at before update on public.proposal_templates for each row execute function public.set_updated_at();
drop trigger if exists b2g_proposals_updated_at on public.b2g_proposals;
create trigger b2g_proposals_updated_at before update on public.b2g_proposals for each row execute function public.set_updated_at();
drop trigger if exists integration_settings_updated_at on public.integration_settings;
create trigger integration_settings_updated_at before update on public.integration_settings for each row execute function public.set_updated_at();

insert into public.proposal_templates(name,pipeline,subject_template,body_template,terms_template) values
('Brand Approval Standard','brand_approval','Brand Approval Proposal — {{organization}}','Scope: Brand/Product approval support, documentation review, submission coordination and follow-up.','Taxes extra. Timeline subject to authority processing.'),
('Government Business Development','government_business_development','Government Market Development Proposal — {{organization}}','Scope: market assessment, opportunity mapping, presentations, tender support and conversion assistance.','Taxes extra. Client to provide technical and commercial inputs.'),
('Tender Consultancy','tender_consultancy','Tender Consultancy Proposal — {{organization}}','Scope: tender evaluation, compliance matrix, BOQ/specification support and bid submission coordination.','Taxes extra. Government fees, EMD and third-party costs excluded.')
on conflict (name) do nothing;

insert into public.integration_settings(provider) values ('whatsapp'),('email'),('website'),('calendar'),('openai') on conflict (provider) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('b2g-documents','b2g-documents',false,26214400,array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

do $$ declare t text; begin
  foreach t in array array['b2g_tasks','proposal_templates','b2g_proposals','b2g_notifications','integration_settings','communication_drafts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists "authenticated_select_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_select_%1$s" on public.%1$I for select to authenticated using ((select auth.uid()) is not null)',t);
    execute format('drop policy if exists "authenticated_insert_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_insert_%1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) is not null)',t);
    execute format('drop policy if exists "authenticated_update_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_update_%1$s" on public.%1$I for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',t);
    execute format('drop policy if exists "authenticated_delete_%1$s" on public.%1$I',t);
    execute format('create policy "authenticated_delete_%1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) is not null)',t);
  end loop;
end $$;

drop policy if exists "b2g_documents_select" on storage.objects;
create policy "b2g_documents_select" on storage.objects for select to authenticated using (bucket_id='b2g-documents');
drop policy if exists "b2g_documents_insert" on storage.objects;
create policy "b2g_documents_insert" on storage.objects for insert to authenticated with check (bucket_id='b2g-documents' and owner_id=(select auth.uid()::text));
drop policy if exists "b2g_documents_update" on storage.objects;
create policy "b2g_documents_update" on storage.objects for update to authenticated using (bucket_id='b2g-documents' and owner_id=(select auth.uid()::text)) with check (bucket_id='b2g-documents' and owner_id=(select auth.uid()::text));
drop policy if exists "b2g_documents_delete" on storage.objects;
create policy "b2g_documents_delete" on storage.objects for delete to authenticated using (bucket_id='b2g-documents' and owner_id=(select auth.uid()::text));

grant select,insert,update,delete on public.b2g_tasks,public.proposal_templates,public.b2g_proposals,public.b2g_notifications,public.integration_settings,public.communication_drafts to authenticated;

create or replace function public.refresh_b2g_escalations()
returns integer language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  update public.b2g_tasks
  set escalation_level=case when due_at < now()-interval '48 hours' then 2 else 1 end
  where completed_at is null and due_at < now() and escalation_level < case when due_at < now()-interval '48 hours' then 2 else 1 end;
  get diagnostics affected = row_count;
  insert into public.b2g_notifications(user_id,lead_id,task_id,notification_type,title,message,severity)
  select t.assigned_to,t.lead_id,t.id,'overdue_follow_up','Overdue: '||t.title,
    'Follow-up was due '||to_char(t.due_at at time zone 'Asia/Kolkata','DD Mon, HH12:MI AM'),
    case when t.escalation_level>=2 then 'urgent' else 'warning' end
  from public.b2g_tasks t
  where t.completed_at is null and t.due_at < now() and t.assigned_to is not null
    and not exists(select 1 from public.b2g_notifications n where n.task_id=t.id and n.notification_type='overdue_follow_up' and n.read_at is null);
  return affected;
end $$;
grant execute on function public.refresh_b2g_escalations() to authenticated;

-- Optional Supabase Cron job after enabling the Cron module in Dashboard:
-- select cron.schedule('tenderexpert-overdue-escalations','*/15 * * * *','select public.refresh_b2g_escalations();');
