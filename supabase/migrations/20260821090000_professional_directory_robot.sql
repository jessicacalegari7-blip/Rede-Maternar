-- Diretório programático seguro e robô de pesquisa de profissionais.
-- Telefones permanecem apenas na tabela privada clinic_prospects.

alter table public.clinic_prospects
  add column if not exists neighborhood text,
  add column if not exists specialty_slug text,
  add column if not exists city_slug text,
  add column if not exists is_claimed boolean not null default false,
  add column if not exists plan_type text not null default 'basic'
    check (plan_type in ('basic','premium')),
  add column if not exists source_record_id text,
  add column if not exists source_payload jsonb not null default '{}'::jsonb,
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists clinic_prospects_directory_idx
  on public.clinic_prospects (specialty_slug, state_code, city_slug, review_status, publication_status);

create table if not exists public.professional_research_targets (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state_code char(2) not null,
  specialty text not null,
  specialty_slug text not null,
  city_slug text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  last_run_at timestamptz,
  last_status text,
  last_result_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (specialty_slug, state_code, city_slug)
);

create table if not exists public.professional_research_runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references public.professional_research_targets(id) on delete set null,
  source_name text not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.professional_research_targets enable row level security;
alter table public.professional_research_runs enable row level security;
revoke all on public.professional_research_targets, public.professional_research_runs from anon, authenticated;
grant select, insert, update, delete on public.professional_research_targets to authenticated;
grant select on public.professional_research_runs to authenticated;
grant select, insert, update, delete on public.professional_research_targets, public.professional_research_runs to service_role;
grant select, insert, update on public.clinic_prospects to service_role;
create policy "research targets admin manage" on public.professional_research_targets
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "research runs admin read" on public.professional_research_runs
  for select to authenticated using (public.is_platform_admin());

drop view if exists public.published_clinic_directory;
create view public.published_clinic_directory as
select id, name, primary_specialty, specialty_slug, city, city_slug, neighborhood,
       state_code, is_claimed, plan_type, created_at, updated_at
from public.clinic_prospects
where review_status = 'approved'
  and publication_status in ('published','claimed');
grant select on public.published_clinic_directory to anon, authenticated;

create or replace function public.directory_search(
  requested_specialty_slug text,
  requested_state_code text,
  requested_city_slug text,
  requested_page integer default 1,
  requested_page_size integer default 20
) returns table (
  id uuid, name text, primary_specialty text, specialty_slug text,
  city text, city_slug text, neighborhood text, state_code char(2),
  is_claimed boolean, plan_type text, total_count bigint
) language sql stable security definer set search_path='' as $$
  select p.id, p.name, p.primary_specialty, p.specialty_slug, p.city, p.city_slug,
         p.neighborhood, p.state_code, p.is_claimed, p.plan_type, count(*) over()
  from public.published_clinic_directory p
  where p.specialty_slug = requested_specialty_slug
    and lower(p.state_code) = lower(requested_state_code)
    and p.city_slug = requested_city_slug
  order by p.plan_type desc, p.is_claimed desc, p.name
  limit least(greatest(requested_page_size,1),50)
  offset (greatest(requested_page,1)-1) * least(greatest(requested_page_size,1),50);
$$;
grant execute on function public.directory_search(text,text,text,integer,integer) to anon, authenticated;

create or replace function public.directory_fallback(
  requested_specialty_slug text,
  requested_state_code text,
  requested_city_slug text
) returns setof public.published_clinic_directory
language sql stable security definer set search_path='' as $$
  select p.* from public.published_clinic_directory p
  where p.specialty_slug = requested_specialty_slug
    and lower(p.state_code)=lower(requested_state_code)
    and p.city_slug<>requested_city_slug
  order by p.plan_type desc, p.is_claimed desc, p.city, p.name limit 6;
$$;
grant execute on function public.directory_fallback(text,text,text) to anon, authenticated;

create or replace function public.admin_review_clinic_prospect(
  target_id uuid, new_review_status text, publish boolean default false
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  if new_review_status not in ('approved','rejected','duplicate') then raise exception 'Status inválido'; end if;
  update public.clinic_prospects set
    review_status=new_review_status,
    publication_status=case when publish and new_review_status='approved' then 'published' else 'unpublished' end,
    reviewed_by=auth.uid(), reviewed_at=now(), updated_at=now()
  where id=target_id;
end;
$$;
grant execute on function public.admin_review_clinic_prospect(uuid,text,boolean) to authenticated;

-- Primeira fila autorizada: Campinas e capitais do Sudeste. Novos alvos podem
-- ser inseridos pelo backoffice sem alterar o código.
insert into public.professional_research_targets(city,state_code,specialty,specialty_slug,city_slug,priority)
select city,state_code,specialty,
  lower(regexp_replace(translate(specialty,'ÁÀÃÂÉÊÍÓÔÕÚÜÇáàãâéêíóôõúüç','AAAAEEIOOOUUCaaaaeeiooouuc'),'[^a-zA-Z0-9]+','-','g')),
  lower(regexp_replace(translate(city,'ÁÀÃÂÉÊÍÓÔÕÚÜÇáàãâéêíóôõúüç','AAAAEEIOOOUUCaaaaeeiooouuc'),'[^a-zA-Z0-9]+','-','g')),
  priority
from (values
  ('Campinas','SP','Pediatria',1),('Campinas','SP','Neuropediatria',2),
  ('Campinas','SP','Fonoaudiologia infantil',3),('Campinas','SP','Consultoria de amamentação',4),
  ('São Paulo','SP','Pediatria',20),('Rio de Janeiro','RJ','Pediatria',20),
  ('Belo Horizonte','MG','Pediatria',20),('Vitória','ES','Pediatria',20)
) as seed(city,state_code,specialty,priority)
on conflict (specialty_slug,state_code,city_slug) do nothing;
