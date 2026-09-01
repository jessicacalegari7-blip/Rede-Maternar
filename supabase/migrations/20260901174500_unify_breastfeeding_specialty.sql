insert into public.specialties(name,slug,active)
values('Consultora de Amamentação','consultora-de-amamentacao',true)
on conflict(slug) do update set name=excluded.name,active=true;

update public.clinic_prospects
set primary_specialty='Consultora de Amamentação',specialty_slug='consultora-de-amamentacao',updated_at=now()
where specialty_slug in ('consultoria-de-amamentacao','consultor-de-amamentacao','consultora-em-amamentacao','consultoria-em-amamentacao');

update public.professional_research_targets
set specialty='Consultora de Amamentação',specialty_slug='consultora-de-amamentacao'
where specialty_slug in ('consultoria-de-amamentacao','consultor-de-amamentacao','consultora-em-amamentacao','consultoria-em-amamentacao')
  and not exists (
    select 1 from public.professional_research_targets canonical
    where canonical.specialty_slug='consultora-de-amamentacao'
      and canonical.state_code=professional_research_targets.state_code
      and canonical.city_slug=professional_research_targets.city_slug
  );

update public.professional_research_targets
set enabled=false,last_status='merged_into_consultora-de-amamentacao'
where specialty_slug in ('consultoria-de-amamentacao','consultor-de-amamentacao','consultora-em-amamentacao','consultoria-em-amamentacao');

update public.specialties
set active=false
where slug in ('consultoria-de-amamentacao','consultor-de-amamentacao','consultora-em-amamentacao','consultoria-em-amamentacao');

create or replace function public.canonical_specialty_slug(value text) returns text language sql immutable parallel safe set search_path='' as $$
select case lower(coalesce(value,''))
  when 'consultoria-de-amamentacao' then 'consultora-de-amamentacao'
  when 'consultor-de-amamentacao' then 'consultora-de-amamentacao'
  when 'consultora-em-amamentacao' then 'consultora-de-amamentacao'
  when 'consultoria-em-amamentacao' then 'consultora-de-amamentacao'
  when 'neuropediatra' then 'neurologista-infantil'
  when 'neuropediatria' then 'neurologista-infantil'
  when 'neurologia-pediatrica' then 'neurologista-infantil'
  when 'neurologista-pediatrico' then 'neurologista-infantil'
  when 'gastropediatra' then 'gastroenterologista-infantil'
  when 'gastro-pediatra' then 'gastroenterologista-infantil'
  when 'gastroenterologia-pediatrica' then 'gastroenterologista-infantil'
  when 'fono-infantil' then 'fonoaudiologa-infantil'
  when 'fonoaudiologia-infantil' then 'fonoaudiologa-infantil'
  when 'pediatria' then 'pediatra'
  else lower(coalesce(value,'')) end; $$;
