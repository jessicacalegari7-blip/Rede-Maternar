create table if not exists public.portal_settings(key text primary key,value jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now(),updated_by uuid references auth.users(id));
alter table public.portal_settings enable row level security;
drop policy if exists "portal settings public read" on public.portal_settings;
create policy "portal settings public read" on public.portal_settings for select to anon,authenticated using(true);
drop policy if exists "portal settings admin manage" on public.portal_settings;
create policy "portal settings admin manage" on public.portal_settings for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
grant select on public.portal_settings to anon,authenticated;
grant insert,update,delete on public.portal_settings to authenticated;
insert into public.portal_settings(key,value) values('editorial_staff','{"responsibleJournalist":"Paulo Roberto Dias","technicalConsultant":"Jéssica Calegari"}'::jsonb) on conflict(key) do nothing;
