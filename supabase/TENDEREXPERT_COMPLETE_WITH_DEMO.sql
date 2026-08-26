-- MK & Associates / TenderExpert - B2G CRM Platform
-- Safe, additive migration. Paste into Supabase SQL Editor and run once.

create extension if not exists pgcrypto;

do $$ begin
  create type public.b2g_pipeline as enum ('brand_approval','government_business_development','tender_consultancy');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.lead_heat as enum ('hot','warm','cold');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_model as enum ('80_20','70_30','50_50','milestone','monthly_retainer','success_fee');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.collection_status as enum ('not_due','partially_paid','paid','overdue','waived');
exception when duplicate_object then null; end $$;

create table if not exists public.b2g_leads (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_name text not null,
  phone text not null,
  email text,
  website text,
  industry text not null,
  state text,
  city text,
  pipeline public.b2g_pipeline not null,
  stage text not null,
  service_interest text[] not null default '{}',
  source text not null default 'manual_entry',
  heat public.lead_heat not null default 'warm',
  ai_score smallint not null default 50 check (ai_score between 0 and 100),
  ai_summary text,
  next_best_action text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  proposal_value numeric(14,2) not null default 0 check (proposal_value >= 0),
  expected_revenue numeric(14,2) not null default 0 check (expected_revenue >= 0),
  probability smallint not null default 20 check (probability between 0 and 100),
  expected_close_date date,
  next_follow_up_at timestamptz,
  last_contacted_at timestamptz,
  notes text,
  lost_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_pipeline_stage check (
    (pipeline = 'brand_approval' and stage = any(array['new_lead','qualified_lead','meeting_scheduled','documents_requested','documents_received','proposal_submitted','negotiation','advance_received','project_started','submission_completed','under_process','approval_completed','final_payment_received','closed'])) or
    (pipeline = 'government_business_development' and stage = any(array['new_lead','business_assessment','opportunity_discussion','proposal_submitted','negotiation','agreement_signed','project_active','technical_presentation','opportunity_identification','tender_support','order_conversion','completed'])) or
    (pipeline = 'tender_consultancy' and stage = any(array['tender_identified','client_discussion','tender_evaluation','go_no_go_decision','proposal_submitted','work_order_received','bid_submission','result_awaited','order_received','completed']))
  )
);

create table if not exists public.b2g_activities (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('call','email','whatsapp','meeting','note','task','stage_change','document','proposal')),
  subject text not null, description text, outcome text, due_at timestamptz, completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now()
);

create table if not exists public.b2g_projects (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.b2g_leads(id) on delete restrict,
  project_name text not null, scope text, payment_model public.payment_model not null,
  contract_value numeric(14,2) not null default 0 check (contract_value >= 0), gst_rate numeric(5,2) not null default 18 check (gst_rate between 0 and 100),
  gst_amount numeric(14,2) generated always as (round(contract_value * gst_rate / 100, 2)) stored,
  start_date date, target_completion_date date, status text not null default 'planned' check (status in ('planned','active','on_hold','completed','cancelled')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.b2g_payment_milestones (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.b2g_projects(id) on delete cascade,
  milestone_name text not null, sequence_no smallint not null default 1, percentage numeric(5,2) check (percentage between 0 and 100),
  amount numeric(14,2) not null check (amount >= 0), gst_amount numeric(14,2) not null default 0 check (gst_amount >= 0),
  due_date date, amount_received numeric(14,2) not null default 0 check (amount_received >= 0), received_at timestamptz,
  status public.collection_status not null default 'not_due', invoice_number text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id, sequence_no), check (amount_received <= amount + gst_amount)
);

create table if not exists public.tender_opportunities (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.b2g_leads(id) on delete set null,
  tender_title text not null, tender_number text, authority_name text not null, department text, portal_url text,
  state text, category text, estimated_value numeric(16,2), emd_amount numeric(14,2), submission_deadline timestamptz,
  go_no_go text not null default 'pending' check (go_no_go in ('pending','go','no_go')),
  match_score smallint check (match_score between 0 and 100), ai_analysis text, status text not null default 'identified',
  owner_id uuid references auth.users(id) on delete set null, created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.b2g_documents (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.b2g_leads(id) on delete cascade,
  project_id uuid references public.b2g_projects(id) on delete cascade, document_type text not null, file_name text not null,
  storage_path text not null, version integer not null default 1, uploaded_by uuid references auth.users(id) on delete set null default auth.uid(), created_at timestamptz not null default now(),
  check (lead_id is not null or project_id is not null)
);

create index if not exists b2g_leads_assigned_stage_idx on public.b2g_leads(assigned_to, pipeline, stage);
create index if not exists b2g_leads_followup_idx on public.b2g_leads(next_follow_up_at) where next_follow_up_at is not null and closed_at is null;
create index if not exists b2g_leads_heat_score_idx on public.b2g_leads(heat, ai_score desc);
create index if not exists b2g_activities_lead_created_idx on public.b2g_activities(lead_id, created_at desc);
create index if not exists b2g_milestones_due_idx on public.b2g_payment_milestones(due_date) where status in ('not_due','partially_paid','overdue');
create index if not exists tender_deadline_idx on public.tender_opportunities(submission_deadline) where go_no_go <> 'no_go';

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists b2g_leads_updated_at on public.b2g_leads;
create trigger b2g_leads_updated_at before update on public.b2g_leads for each row execute function public.set_updated_at();
drop trigger if exists b2g_projects_updated_at on public.b2g_projects;
create trigger b2g_projects_updated_at before update on public.b2g_projects for each row execute function public.set_updated_at();
drop trigger if exists b2g_milestones_updated_at on public.b2g_payment_milestones;
create trigger b2g_milestones_updated_at before update on public.b2g_payment_milestones for each row execute function public.set_updated_at();
drop trigger if exists tender_updated_at on public.tender_opportunities;
create trigger tender_updated_at before update on public.tender_opportunities for each row execute function public.set_updated_at();

create or replace view public.b2g_revenue_summary with (security_invoker = true) as
select p.id project_id, p.project_name, p.contract_value, p.gst_amount,
  coalesce(sum(m.amount_received),0) received,
  coalesce(sum(m.amount + m.gst_amount - m.amount_received),0) outstanding,
  min(m.due_date) filter (where m.status in ('not_due','partially_paid','overdue')) next_due_date
from public.b2g_projects p left join public.b2g_payment_milestones m on m.project_id=p.id group by p.id;

alter table public.b2g_leads enable row level security;
alter table public.b2g_activities enable row level security;
alter table public.b2g_projects enable row level security;
alter table public.b2g_payment_milestones enable row level security;
alter table public.tender_opportunities enable row level security;
alter table public.b2g_documents enable row level security;

do $$ declare t text; begin
  foreach t in array array['b2g_leads','b2g_activities','b2g_projects','b2g_payment_milestones','tender_opportunities','b2g_documents'] loop
    execute format('drop policy if exists "team_select_%1$s" on public.%1$I', t);
    execute format('create policy "team_select_%1$s" on public.%1$I for select to authenticated using ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "team_insert_%1$s" on public.%1$I', t);
    execute format('create policy "team_insert_%1$s" on public.%1$I for insert to authenticated with check ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "team_update_%1$s" on public.%1$I', t);
    execute format('create policy "team_update_%1$s" on public.%1$I for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "team_delete_%1$s" on public.%1$I', t);
    execute format('create policy "team_delete_%1$s" on public.%1$I for delete to authenticated using ((select auth.uid()) is not null)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.b2g_leads, public.b2g_activities, public.b2g_projects, public.b2g_payment_milestones, public.tender_opportunities, public.b2g_documents to authenticated;
grant select on public.b2g_revenue_summary to authenticated;



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


-- TenderExpert realistic demo data. Run after TENDEREXPERT_CRM_COMPLETE_SETUP.sql.
-- Safe to run multiple times: fixed UUIDs + ON CONFLICT updates.

insert into public.b2g_leads
(id,organization_name,contact_name,phone,email,website,industry,state,city,pipeline,stage,service_interest,source,heat,ai_score,ai_summary,next_best_action,proposal_value,expected_revenue,probability,expected_close_date,next_follow_up_at,last_contacted_at,notes)
values
('10000000-0000-0000-0000-000000000001','AquaFlow Systems Pvt. Ltd.','Rajiv Mehta','9876501001','rajiv@aquaflow.example','https://aquaflow.example','Water & Wastewater','Maharashtra','Pune','brand_approval','documents_received',array['Brand / Product Approval','Vendor Registration'],'referral','hot',88,'Strong product readiness, decision-maker engaged and documents substantially complete.','Review remaining test certificates and schedule submission meeting.',850000,680000,80,current_date+25,now()+interval '2 hours',now()-interval '1 day','Seeking product approval across multiple state water boards.'),
('10000000-0000-0000-0000-000000000002','Medivance Healthcare Ltd.','Dr. Neha Sharma','9876501002','neha@medivance.example',null,'Healthcare','Delhi','New Delhi','brand_approval','meeting_scheduled',array['Brand / Product Approval','Government Market Entry'],'website','warm',72,'Good fit with central procurement opportunity; regulatory documents need assessment.','Conduct government readiness and documentation gap assessment.',525000,315000,60,current_date+40,now()+interval '1 day',now()-interval '3 days','Medical equipment manufacturer entering government procurement.'),
('10000000-0000-0000-0000-000000000003','Shakti Industrial Pumps','Vikram Singh','9876501003','vikram@shaktipumps.example',null,'Manufacturing','Gujarat','Ahmedabad','brand_approval','proposal_submitted',array['Brand / Product Approval','Technical Presentation'],'email','hot',91,'Proposal shared; urgent requirement linked to an upcoming departmental procurement.','Follow up on commercial approval and advance payment.',1200000,960000,80,current_date+15,now()-interval '3 hours',now()-interval '2 days','Industrial pump approvals and technical presentations.'),
('10000000-0000-0000-0000-000000000004','NexGrid Technologies Pvt. Ltd.','Arun Iyer','9876501004','arun@nexgrid.example','https://nexgrid.example','Technology','Karnataka','Bengaluru','government_business_development','business_assessment',array['Government Business Development','Government Market Entry','Tender Intelligence'],'event','warm',68,'Technology is relevant to smart-city programs; government credentials are limited.','Complete government readiness assessment and target-account mapping.',1800000,720000,40,current_date+60,now()+interval '2 days',now()-interval '5 days','IoT and smart infrastructure solutions.'),
('10000000-0000-0000-0000-000000000005','EcoBuild Infra Projects','Sanjay Kulkarni','9876501005','sanjay@ecobuild.example',null,'Infrastructure','Madhya Pradesh','Indore','government_business_development','technical_presentation',array['Government Business Development','Technical Presentation','BOQ & Specification Support'],'referral','hot',84,'Active departmental engagement and validated technical requirement.','Finalize technical presentation and identify pilot opportunity.',2400000,1680000,70,current_date+35,now()+interval '5 hours',now()-interval '1 day','Sustainable infrastructure and municipal projects.'),
('10000000-0000-0000-0000-000000000006','BioPure Treatment Solutions','Kavita Rao','9876501006','kavita@biopure.example',null,'Water & Wastewater','Telangana','Hyderabad','government_business_development','order_conversion',array['Government Business Development','Opportunity Identification','Tender Support'],'existing_customer','hot',94,'Government business engagement converted successfully.','Continue account growth and identify the next opportunity.',3600000,3600000,100,current_date-10,null,now()-interval '8 hours','Annual government business development engagement converted.'),
('10000000-0000-0000-0000-000000000007','SecureWave Networks','Mohit Bansal','9876501007','mohit@securewave.example',null,'Technology','Haryana','Gurugram','tender_consultancy','tender_evaluation',array['Tender Consultancy','BOQ & Specification Support'],'whatsapp','warm',66,'Tender fit is positive but OEM authorization and turnover criteria need confirmation.','Complete eligibility matrix and obtain OEM authorization.',450000,225000,50,current_date+18,now()+interval '4 hours',now()-interval '2 days','Cybersecurity tender for a state agency.'),
('10000000-0000-0000-0000-000000000008','Prime Engineering Consortium','Amit Jain','9876501008','amit@primeengineering.example',null,'Engineering','Rajasthan','Jaipur','tender_consultancy','bid_submission',array['Tender Consultancy','BOQ & Specification Support','Tender Intelligence'],'tender_portal','hot',89,'Bid is in final submission stage; all major compliance items completed.','Perform final bid review and submit before portal rush.',950000,855000,90,current_date+8,now()+interval '1 hour',now()-interval '5 hours','Consultancy for public works equipment tender.'),
('10000000-0000-0000-0000-000000000009','Zenith Medical Devices','Pooja Nair','9876501009','pooja@zenithmedical.example',null,'Healthcare','Tamil Nadu','Chennai','tender_consultancy','order_received',array['Tender Consultancy','Vendor Registration'],'referral','warm',96,'Tender converted and government order received.','Complete delivery handover and success-fee collection.',675000,675000,100,current_date-5,null,now()-interval '4 days','Government diagnostic equipment order received.')
on conflict(id) do update set
organization_name=excluded.organization_name,contact_name=excluded.contact_name,phone=excluded.phone,email=excluded.email,
pipeline=excluded.pipeline,stage=excluded.stage,heat=excluded.heat,ai_score=excluded.ai_score,ai_summary=excluded.ai_summary,
next_best_action=excluded.next_best_action,proposal_value=excluded.proposal_value,expected_revenue=excluded.expected_revenue,
probability=excluded.probability,next_follow_up_at=excluded.next_follow_up_at,notes=excluded.notes;

insert into public.b2g_activities(id,lead_id,activity_type,subject,description,created_at) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','meeting','Documentation review','Reviewed company profile, test certificates and product catalogue.',now()-interval '3 days'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','proposal','Commercial proposal shared','Proposal shared for product approval and technical presentation support.',now()-interval '2 days'),
('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','meeting','Department presentation planning','Agreed presentation flow and identified technical decision makers.',now()-interval '1 day'),
('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000008','call','Final bid checklist','Confirmed EMD, authorization, BOQ and signed annexures.',now()-interval '5 hours')
on conflict(id) do nothing;

insert into public.b2g_projects(id,lead_id,project_name,scope,payment_model,contract_value,gst_rate,start_date,target_completion_date,status) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Water Board Product Approval','Documentation, submission and approval coordination','80_20',850000,18,current_date-10,current_date+60,'active'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006','Government Business Development Retainer','Opportunity mapping, presentations and tender support','monthly_retainer',3600000,18,current_date-30,current_date+335,'active')
on conflict(id) do update set contract_value=excluded.contract_value,status=excluded.status;

insert into public.b2g_payment_milestones(id,project_id,milestone_name,sequence_no,percentage,amount,gst_amount,due_date,amount_received,received_at,status,invoice_number) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Advance',1,80,680000,122400,current_date-8,802400,now()-interval '8 days','paid','TE/26-27/001'),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Approval completion',2,20,170000,30600,current_date+55,0,null,'not_due',null),
('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','Month 1 Retainer',1,null,300000,54000,current_date-25,354000,now()-interval '24 days','paid','TE/26-27/002'),
('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000002','Month 2 Retainer',2,null,300000,54000,current_date+5,150000,now()-interval '2 days','partially_paid','TE/26-27/006')
on conflict(id) do update set amount_received=excluded.amount_received,status=excluded.status,received_at=excluded.received_at;

insert into public.b2g_tasks(id,lead_id,title,task_type,priority,due_at,assigned_to,completed_at) values
('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','Follow up for proposal approval','follow_up','urgent',now()-interval '3 hours',null,null),
('50000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000008','Final tender submission review','tender','urgent',now()+interval '1 hour',null,null),
('50000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000005','Prepare technical presentation','meeting','high',now()+interval '5 hours',null,null),
('50000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','Government readiness assessment','document','medium',now()+interval '1 day',null,null)
on conflict(id) do update set due_at=excluded.due_at,completed_at=null;

insert into public.tender_opportunities(id,lead_id,tender_title,tender_number,authority_name,department,state,estimated_value,emd_amount,submission_deadline,go_no_go,match_score,ai_analysis,status) values
('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','State Data Centre Network Security Upgrade','SDC/SEC/2026/118','State IT Department','Data Centre Division','Haryana',48500000,970000,now()+interval '12 days','pending',74,'Technical fit is strong. Verify OEM authorization, turnover threshold and three similar-work credentials.','identified'),
('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000008','Supply of Public Works Testing Equipment','PWD/EQP/2026/44','Public Works Department','Quality Control','Rajasthan',27500000,550000,now()+interval '2 days','go',91,'High match. Technical compliance and past performance criteria are satisfied. Final commercial review pending.','evaluation'),
('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000009','Diagnostic Equipment Rate Contract','DME/RC/2026/09','Directorate of Medical Education','Procurement','Tamil Nadu',62000000,1240000,now()-interval '5 days','go',86,'Bid submitted and technically qualified. Monitor commercial opening and clarification notices.','result_awaited')
on conflict(id) do update set submission_deadline=excluded.submission_deadline,go_no_go=excluded.go_no_go,match_score=excluded.match_score,status=excluded.status;

insert into public.b2g_proposals(id,lead_id,proposal_number,subject,scope,commercial_terms,payment_model,subtotal,gst_rate,status,valid_until,sent_at) values
('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','TE-DEMO-001','Product Approval & Technical Presentation Proposal','Product approval documentation, authority submission, follow-up and technical presentation support.','80% advance and 20% on completion. GST extra.','80_20',1200000,18,'sent',current_date+15,now()-interval '2 days'),
('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','TE-DEMO-002','Government Business Development Engagement','Department mapping, technical presentations, opportunity identification and tender support.','70% advance and 30% on agreed milestone. GST extra.','70_30',2400000,18,'draft',current_date+20,null)
on conflict(id) do update set status=excluded.status,subtotal=excluded.subtotal;

select 'TenderExpert demo data installed' as result,
  (select count(*) from public.b2g_leads where id::text like '10000000-%') as demo_leads,
  (select count(*) from public.b2g_projects where id::text like '30000000-%') as demo_projects,
  (select count(*) from public.tender_opportunities where id::text like '60000000-%') as demo_tenders;
