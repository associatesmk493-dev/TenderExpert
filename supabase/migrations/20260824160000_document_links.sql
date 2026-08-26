-- TenderExpert CRM: multiple external documentation links per lead
create table if not exists public.b2g_document_links (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.b2g_leads(id) on delete cascade,
  title text not null,
  url text not null check (url ~* '^https?://'),
  document_type text not null default 'drive_link',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists b2g_document_links_lead_created_idx
  on public.b2g_document_links(lead_id, created_at desc);

alter table public.b2g_document_links enable row level security;

drop policy if exists "authenticated_select_b2g_document_links" on public.b2g_document_links;
create policy "authenticated_select_b2g_document_links" on public.b2g_document_links
  for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists "authenticated_insert_b2g_document_links" on public.b2g_document_links;
create policy "authenticated_insert_b2g_document_links" on public.b2g_document_links
  for insert to authenticated with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_update_b2g_document_links" on public.b2g_document_links;
create policy "authenticated_update_b2g_document_links" on public.b2g_document_links
  for update to authenticated using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "authenticated_delete_b2g_document_links" on public.b2g_document_links;
create policy "authenticated_delete_b2g_document_links" on public.b2g_document_links
  for delete to authenticated using ((select auth.uid()) is not null);

grant select, insert, update, delete on public.b2g_document_links to authenticated;

