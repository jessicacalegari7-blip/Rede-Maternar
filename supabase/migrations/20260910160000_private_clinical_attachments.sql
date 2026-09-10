insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('clinical-attachments','clinical-attachments',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "clinical attachments organization read" on storage.objects;
drop policy if exists "clinical attachments organization insert" on storage.objects;
drop policy if exists "clinical attachments organization delete" on storage.objects;
create policy "clinical attachments organization read" on storage.objects for select to authenticated
using(bucket_id='clinical-attachments' and public.can_access_organization_module(((storage.foldername(name))[1])::uuid,'crm','read'));
create policy "clinical attachments organization insert" on storage.objects for insert to authenticated
with check(bucket_id='clinical-attachments' and (storage.foldername(name))[3]=auth.uid()::text and public.can_access_organization_module(((storage.foldername(name))[1])::uuid,'crm','write'));
create policy "clinical attachments organization delete" on storage.objects for delete to authenticated
using(bucket_id='clinical-attachments' and public.can_access_organization_module(((storage.foldername(name))[1])::uuid,'crm','write'));
