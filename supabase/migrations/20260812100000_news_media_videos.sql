insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('news-media','news-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "news media public read" on storage.objects;
create policy "news media public read" on storage.objects for select to public using (bucket_id='news-media');
drop policy if exists "news media admin insert" on storage.objects;
create policy "news media admin insert" on storage.objects for insert to authenticated with check (bucket_id='news-media' and public.is_platform_admin());
drop policy if exists "news media admin update" on storage.objects;
create policy "news media admin update" on storage.objects for update to authenticated using (bucket_id='news-media' and public.is_platform_admin()) with check (bucket_id='news-media' and public.is_platform_admin());
drop policy if exists "news media admin delete" on storage.objects;
create policy "news media admin delete" on storage.objects for delete to authenticated using (bucket_id='news-media' and public.is_platform_admin());

create table if not exists public.portal_videos (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'), published boolean not null default false,
 featured boolean not null default false, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.portal_videos enable row level security;
drop policy if exists "published videos public read" on public.portal_videos;
create policy "published videos public read" on public.portal_videos for select to anon,authenticated using (published or public.is_platform_admin());
drop policy if exists "videos admin manage" on public.portal_videos;
create policy "videos admin manage" on public.portal_videos for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
grant select on public.portal_videos to anon,authenticated;
grant insert,update,delete on public.portal_videos to authenticated;
