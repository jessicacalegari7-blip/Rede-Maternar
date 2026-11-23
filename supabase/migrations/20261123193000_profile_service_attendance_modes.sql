-- Cada serviço do Perfil Premium escolhe suas próprias modalidades de atendimento.
create or replace function public.save_professional_profile_services(target_professional_id uuid,service_rows jsonb)
returns setof public.services language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; item jsonb; service_id uuid; kept_ids uuid[]:='{}'; duration_value integer; price_value integer; modes text[];
begin
  select * into profile from public.professional_profiles where id=target_professional_id;
  if profile.id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if not (public.is_organization_member(profile.organization_id) or public.is_platform_admin()) then raise exception 'Acesso negado ao perfil'; end if;
  if jsonb_typeof(service_rows)<>'array' then raise exception 'Lista de serviços inválida'; end if;
  for item in select value from jsonb_array_elements(service_rows) loop
    if coalesce(trim(item->>'name'),'')='' and coalesce(trim(item->>'description'),'')='' and nullif(item->>'duration_minutes','') is null and nullif(item->>'price_cents','') is null then continue; end if;
    duration_value:=nullif(item->>'duration_minutes','')::integer; price_value:=nullif(item->>'price_cents','')::integer;
    if duration_value is not null and duration_value<1 then raise exception 'Tempo estimado inválido'; end if;
    if price_value is not null and price_value<0 then raise exception 'Valor inválido'; end if;
    if exists(select 1 from jsonb_array_elements_text(coalesce(item->'attendance_modes','[]'::jsonb)) mode where mode not in ('presencial','online','domiciliar')) then raise exception 'Modalidade de atendimento inválida'; end if;
    select coalesce(array_agg(distinct mode),'{}'::text[]) into modes from jsonb_array_elements_text(coalesce(item->'attendance_modes','[]'::jsonb)) mode;
    service_id:=nullif(item->>'id','')::uuid;
    if service_id is null then
      insert into public.services(organization_id,professional_id,name,description,duration_minutes,price_cents,attendance_modes,marketplace_visible,active,created_by)
      values(profile.organization_id,target_professional_id,nullif(trim(item->>'name'),''),nullif(trim(item->>'description'),''),duration_value,price_value,modes,true,true,auth.uid()) returning id into service_id;
    else
      update public.services set professional_id=target_professional_id,name=nullif(trim(item->>'name'),''),description=nullif(trim(item->>'description'),''),duration_minutes=duration_value,price_cents=price_value,attendance_modes=modes,marketplace_visible=true,active=true,updated_at=now()
      where id=service_id and organization_id=profile.organization_id and (professional_id is null or professional_id=target_professional_id) returning id into service_id;
      if service_id is null then raise exception 'Serviço inválido'; end if;
    end if;
    kept_ids:=array_append(kept_ids,service_id);
  end loop;
  update public.services set active=false,updated_at=now() where professional_id=target_professional_id and active and not(id=any(kept_ids));
  return query select * from public.services where professional_id=target_professional_id and active order by name nulls last,id;
end $$;

revoke all on function public.save_professional_profile_services(uuid,jsonb) from public,anon;
grant execute on function public.save_professional_profile_services(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
