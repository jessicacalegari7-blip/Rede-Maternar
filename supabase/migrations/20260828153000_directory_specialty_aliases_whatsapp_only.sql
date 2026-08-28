-- Consolida sinônimos e publica somente prospecções com WhatsApp público.
update public.clinic_prospects set primary_specialty='Neurologista Infantil',specialty_slug='neurologista-infantil',updated_at=now()
where specialty_slug in ('neuropediatra','neuropediatria','neurologia-pediatrica','neurologista-pediatrico') or lower(primary_specialty) in ('neuropediatra','neuropediatria','neurologia pediátrica','neurologista pediátrico');
update public.clinic_prospects set primary_specialty='Gastroenterologista Infantil',specialty_slug='gastroenterologista-infantil',updated_at=now()
where specialty_slug in ('gastropediatra','gastro-pediatra','gastroenterologia-pediatrica');
update public.clinic_prospects set primary_specialty='Fonoaudióloga Infantil',specialty_slug='fonoaudiologa-infantil',updated_at=now() where specialty_slug in ('fono-infantil','fonoaudiologia-infantil');
update public.clinic_prospects set primary_specialty='Pediatra',specialty_slug='pediatra',updated_at=now() where specialty_slug='pediatria';
update public.clinic_prospects set publication_status='unpublished',updated_at=now()
where nullif(regexp_replace(coalesce(whatsapp,''),'\D','','g'),'') is null and is_claimed is not true;
drop view if exists public.published_clinic_directory;
create view public.published_clinic_directory as
select id,name,primary_specialty,specialty_slug,city,city_slug,neighborhood,state_code,is_claimed,plan_type,created_at,updated_at
from public.clinic_prospects where review_status='approved' and publication_status in ('published','claimed')
and (is_claimed is true or nullif(regexp_replace(coalesce(whatsapp,''),'\D','','g'),'') is not null);
grant select on public.published_clinic_directory to anon,authenticated;
create or replace function public.canonical_specialty_slug(value text) returns text language sql immutable parallel safe set search_path='' as $$
select case lower(coalesce(value,'')) when 'neuropediatra' then 'neurologista-infantil' when 'neuropediatria' then 'neurologista-infantil' when 'neurologia-pediatrica' then 'neurologista-infantil' when 'neurologista-pediatrico' then 'neurologista-infantil' when 'gastropediatra' then 'gastroenterologista-infantil' when 'gastro-pediatra' then 'gastroenterologista-infantil' when 'gastroenterologia-pediatrica' then 'gastroenterologista-infantil' when 'fono-infantil' then 'fonoaudiologa-infantil' when 'fonoaudiologia-infantil' then 'fonoaudiologa-infantil' when 'pediatria' then 'pediatra' else lower(coalesce(value,'')) end; $$;
create or replace function public.directory_search_by_city(requested_specialty_slug text,requested_city_slug text,requested_page integer default 1,requested_page_size integer default 20)
returns table(id uuid,name text,primary_specialty text,specialty_slug text,city text,city_slug text,neighborhood text,state_code char(2),is_claimed boolean,plan_type text,total_count bigint)
language sql stable security definer set search_path='' as $$ select p.id,p.name,p.primary_specialty,p.specialty_slug,p.city,p.city_slug,p.neighborhood,p.state_code,p.is_claimed,p.plan_type,count(*) over() from public.published_clinic_directory p where public.canonical_specialty_slug(p.specialty_slug)=public.canonical_specialty_slug(requested_specialty_slug) and p.city_slug=requested_city_slug order by p.plan_type desc,p.is_claimed desc,p.name limit least(greatest(requested_page_size,1),50) offset (greatest(requested_page,1)-1)*least(greatest(requested_page_size,1),50); $$;
grant execute on function public.directory_search_by_city(text,text,integer,integer) to anon,authenticated;
