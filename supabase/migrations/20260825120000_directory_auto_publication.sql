-- Publicação automática segura do diretório: somente dados não sensíveis são
-- expostos pela view pública. WhatsApp e payload de origem permanecem privados.

insert into public.specialties (name, slug) values
  ('Cirurgia pediátrica', 'cirurgia-pediatrica'),
  ('Gastroenterologia pediátrica', 'gastroenterologia-pediatrica'),
  ('Genética médica', 'genetica-medica'),
  ('Hematologia pediátrica', 'hematologia-pediatrica'),
  ('Infectologia pediátrica', 'infectologia-pediatrica'),
  ('Mastologia', 'mastologia'),
  ('Medicina fetal', 'medicina-fetal'),
  ('Musicoterapia infantil', 'musicoterapia-infantil'),
  ('Nefrologia pediátrica', 'nefrologia-pediatrica'),
  ('Nutrologia pediátrica', 'nutrologia-pediatrica'),
  ('Oftalmologia pediátrica', 'oftalmologia-pediatrica'),
  ('Ortopedia pediátrica', 'ortopedia-pediatrica'),
  ('Otorrinolaringologia pediátrica', 'otorrinolaringologia-pediatrica'),
  ('Pneumologia pediátrica', 'pneumologia-pediatrica'),
  ('Reprodução humana', 'reproducao-humana'),
  ('Reumatologia pediátrica', 'reumatologia-pediatrica'),
  ('Urologia pediátrica', 'urologia-pediatrica')
on conflict (slug) do update set name=excluded.name, active=true;

alter table public.professional_research_targets
  add column if not exists city_population bigint,
  add column if not exists city_rank integer;

alter table public.clinic_prospects alter column review_status set default 'approved';
alter table public.clinic_prospects alter column publication_status set default 'published';

update public.clinic_prospects
set review_status='approved', publication_status='published', reviewed_at=coalesce(reviewed_at,now()), updated_at=now()
where review_status='pending' and publication_status='unpublished'
  and nullif(trim(name),'') is not null
  and nullif(trim(primary_specialty),'') is not null
  and nullif(trim(city),'') is not null;

create or replace function public.directory_search_by_city(
  requested_specialty_slug text,
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
  where p.specialty_slug=requested_specialty_slug and p.city_slug=requested_city_slug
  order by p.plan_type desc, p.is_claimed desc, p.name
  limit least(greatest(requested_page_size,1),50)
  offset (greatest(requested_page,1)-1)*least(greatest(requested_page_size,1),50);
$$;
grant execute on function public.directory_search_by_city(text,text,integer,integer) to anon, authenticated;

create or replace function public.directory_fallback_by_city(
  requested_specialty_slug text,
  requested_city_slug text
) returns setof public.published_clinic_directory
language sql stable security definer set search_path='' as $$
  select p.* from public.published_clinic_directory p
  where p.specialty_slug=requested_specialty_slug and p.city_slug<>requested_city_slug
  order by p.plan_type desc, p.is_claimed desc, p.city, p.name limit 6;
$$;
grant execute on function public.directory_fallback_by_city(text,text) to anon, authenticated;
