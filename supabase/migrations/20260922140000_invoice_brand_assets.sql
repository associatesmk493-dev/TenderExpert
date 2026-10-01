insert into storage.buckets (id, name, public) values ('invoice-assets','invoice-assets',true) on conflict (id) do update set public=true;
drop policy if exists invoice_assets_read on storage.objects;
create policy invoice_assets_read on storage.objects for select to authenticated using (bucket_id='invoice-assets');
drop policy if exists invoice_assets_insert on storage.objects;
create policy invoice_assets_insert on storage.objects for insert to authenticated with check (bucket_id='invoice-assets');
drop policy if exists invoice_assets_update on storage.objects;
create policy invoice_assets_update on storage.objects for update to authenticated using (bucket_id='invoice-assets') with check (bucket_id='invoice-assets');
