alter table public.clinic_prospects
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists clinic_prospects_coordinates_idx
  on public.clinic_prospects(latitude,longitude)
  where latitude is not null and longitude is not null;

create or replace view public.published_clinic_directory as
select id,name,primary_specialty,specialty_slug,city,city_slug,neighborhood,state_code,
       is_claimed,plan_type,created_at,updated_at,latitude,longitude
from public.clinic_prospects
where review_status='approved'
  and publication_status in ('published','claimed')
  and (is_claimed is true or nullif(regexp_replace(coalesce(whatsapp,''),'\D','','g'),'') is not null);

grant select on public.published_clinic_directory to anon,authenticated;

create or replace function public.directory_nearby(
  requested_specialty_slug text,
  requested_latitude double precision,
  requested_longitude double precision,
  requested_radius_km double precision default 30
) returns table(
  id uuid,name text,primary_specialty text,specialty_slug text,city text,city_slug text,
  neighborhood text,state_code char(2),is_claimed boolean,plan_type text,distance_km double precision
) language sql stable security definer set search_path='' as $$
  select p.id,p.name,p.primary_specialty,p.specialty_slug,p.city,p.city_slug,p.neighborhood,
         p.state_code,p.is_claimed,p.plan_type,
         6371*2*asin(sqrt(
           power(sin(radians(p.latitude-requested_latitude)/2),2)+
           cos(radians(requested_latitude))*cos(radians(p.latitude))*
           power(sin(radians(p.longitude-requested_longitude)/2),2)
         )) as distance_km
  from public.published_clinic_directory p
  where p.latitude is not null and p.longitude is not null
    and public.canonical_specialty_slug(p.specialty_slug)=public.canonical_specialty_slug(requested_specialty_slug)
    and 6371*2*asin(sqrt(
      power(sin(radians(p.latitude-requested_latitude)/2),2)+
      cos(radians(requested_latitude))*cos(radians(p.latitude))*
      power(sin(radians(p.longitude-requested_longitude)/2),2)
    ))<=least(greatest(requested_radius_km,1),30)
  order by distance_km,p.plan_type desc,p.is_claimed desc,p.name
  limit 12;
$$;

grant execute on function public.directory_nearby(text,double precision,double precision,double precision)
  to anon,authenticated,service_role;
