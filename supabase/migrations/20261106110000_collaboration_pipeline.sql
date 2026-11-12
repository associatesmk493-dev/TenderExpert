-- New "Collaboration" pipeline for partnership / collaboration leads.
alter type public.b2g_pipeline add value if not exists 'collaboration';

-- Constraint compares pipeline::text so the new enum value is not "used" in the same transaction
-- (Postgres rejects that), which lets this whole script run in one go in the SQL editor.
alter table public.b2g_leads drop constraint if exists valid_pipeline_stage;
alter table public.b2g_leads add constraint valid_pipeline_stage check (
  (pipeline::text = 'brand_approval' and stage = any(array['new_lead','qualified_lead','meeting_scheduled','documents_requested','documents_received','proposal_submitted','negotiation','generate_pi','advance_received','project_started','submission_completed','under_process','approval_completed','final_payment_received','closed'])) or
  (pipeline::text = 'government_business_development' and stage = any(array['new_lead','business_assessment','opportunity_discussion','proposal_submitted','negotiation','generate_pi','agreement_signed','project_active','technical_presentation','opportunity_identification','tender_support','order_conversion','completed'])) or
  (pipeline::text = 'tender_consultancy' and stage = any(array['tender_identified','client_discussion','tender_evaluation','go_no_go_decision','proposal_submitted','generate_pi','work_order_received','bid_submission','result_awaited','order_received','completed'])) or
  (pipeline::text = 'collaboration' and stage = any(array['new_lead','qualified_lead','partner_discussion','terms_proposed','proposal_submitted','negotiation','agreement_signed','collaboration_active','completed']))
);
