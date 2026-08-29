-- Publica automaticamente pré-cadastros válidos mesmo sem WhatsApp.
-- O número permanece privado em clinic_prospects e não integra a view pública.

alter table public.clinic_prospects
  alter column review_status set default 'approved',
  alter column publication_status set default 'published';

update public.clinic_prospects
set review_status = 'approved',
    publication_status = 'published',
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
where review_status = 'pending'
  and publication_status = 'unpublished'
  and nullif(trim(name), '') is not null
  and nullif(trim(primary_specialty), '') is not null
  and nullif(trim(city), '') is not null
  and state_code is not null;

create or replace view public.published_clinic_directory as
select
  id,
  name,
  primary_specialty,
  specialty_slug,
  city,
  city_slug,
  neighborhood,
  state_code,
  is_claimed,
  plan_type,
  latitude,
  longitude,
  created_at,
  updated_at
from public.clinic_prospects
where review_status = 'approved'
  and publication_status in ('published', 'claimed');

grant select on public.published_clinic_directory to anon, authenticated, service_role;
