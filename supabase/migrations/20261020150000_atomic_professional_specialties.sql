-- Evita perda das especialidades quando uma gravação falha após o delete anterior.
create or replace function public.save_professional_specialties_v2(
  target_professional_id uuid,
  specialty_names text[]
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  profile public.professional_profiles;
  requested_count integer;
  matched_count integer;
begin
  select * into profile from public.professional_profiles where id=target_professional_id;
  if profile.id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if not (public.is_organization_member(profile.organization_id) or public.is_platform_admin()) then
    raise exception 'Acesso negado ao perfil';
  end if;

  select count(distinct trim(name)) into requested_count
  from unnest(coalesce(specialty_names,'{}'::text[])) name
  where trim(name)<>'';

  select count(*) into matched_count
  from public.specialties specialty
  where specialty.active
    and specialty.name in (
      select distinct trim(name)
      from unnest(coalesce(specialty_names,'{}'::text[])) name
      where trim(name)<>''
    );
  if matched_count<>requested_count then raise exception 'Uma das especialidades selecionadas não está disponível'; end if;

  delete from public.professional_specialties where professional_id=target_professional_id;
  insert into public.professional_specialties(professional_id,specialty_id,is_primary)
  select target_professional_id,specialty.id,
    row_number() over(order by array_position(specialty_names,specialty.name))=1
  from public.specialties specialty
  where specialty.active and specialty.name=any(coalesce(specialty_names,'{}'::text[]))
  order by array_position(specialty_names,specialty.name);
end $$;

revoke all on function public.save_professional_specialties_v2(uuid,text[]) from public;
grant execute on function public.save_professional_specialties_v2(uuid,text[]) to authenticated;
notify pgrst, 'reload schema';
