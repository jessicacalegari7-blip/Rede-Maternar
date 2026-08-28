-- Reconhece de forma determinística a administradora oficial tanto por perfil
-- quanto pelo e-mail autenticado no JWT. Mantém a tabela privada de prospecção
-- acessível somente ao backoffice administrativo.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = 'jessica.calegari7@gmail.com'
    or exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_platform_admin=true),
    false
  );
$$;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to anon, authenticated, service_role;

insert into public.profiles(id,full_name,status,is_platform_admin)
select id,coalesce(nullif(raw_user_meta_data->>'full_name',''),'Jessica Calegari'),'active'::public.account_status,true
from auth.users where lower(email)='jessica.calegari7@gmail.com'
on conflict(id) do update set is_platform_admin=true,status='active'::public.account_status,updated_at=now();

drop policy if exists "clinic prospects admin manage" on public.clinic_prospects;
create policy "clinic prospects admin manage" on public.clinic_prospects
for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

drop policy if exists "research targets admin manage" on public.professional_research_targets;
create policy "research targets admin manage" on public.professional_research_targets
for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

drop policy if exists "research runs admin read" on public.professional_research_runs;
create policy "research runs admin read" on public.professional_research_runs
for select to authenticated using(public.is_platform_admin());

grant select,insert,update,delete on public.clinic_prospects,public.professional_research_targets to authenticated;
grant select on public.professional_research_runs to authenticated;
