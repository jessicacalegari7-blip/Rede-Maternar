-- Persiste locais, endereço principal e cidades usadas na busca em uma só transação.
create or replace function public.save_professional_service_locations_v2(target_professional_id uuid,location_rows jsonb)
returns setof public.professional_service_locations
language plpgsql
security definer
set search_path=''
as $$
declare
  profile public.professional_profiles;
  item jsonb;
  location_id uuid;
  kept_ids uuid[]:='{}';
  position integer:=0;
  first_location public.professional_service_locations;
begin
  select * into profile from public.professional_profiles where id=target_professional_id;
  if profile.id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if not (public.is_organization_member(profile.organization_id) or public.is_platform_admin()) then raise exception 'Acesso negado ao perfil'; end if;
  if jsonb_typeof(location_rows)<>'array' then raise exception 'Lista de locais inválida'; end if;

  for item in select value from jsonb_array_elements(location_rows) loop
    position:=position+1;
    if length(trim(coalesce(item->>'name','')))<2
      or length(trim(coalesce(item->>'address_line','')))<2
      or trim(coalesce(item->>'address_number',''))=''
      or trim(coalesce(item->>'city',''))=''
      or length(trim(coalesce(item->>'state_code','')))<>2
      or length(regexp_replace(coalesce(item->>'postal_code',''),'\D','','g'))<>8 then
      raise exception 'Preencha nome, CEP, endereço, número, cidade e UF de todos os locais de atendimento';
    end if;

    location_id:=nullif(item->>'id','')::uuid;
    if location_id is not null then
      update public.professional_service_locations set
        name=trim(item->>'name'),address_line=trim(item->>'address_line'),
        address_number=trim(item->>'address_number'),address_complement=nullif(trim(item->>'address_complement'),''),
        neighborhood=nullif(trim(item->>'neighborhood'),''),city=trim(item->>'city'),
        state_code=upper(trim(item->>'state_code'))::char(2),postal_code=regexp_replace(item->>'postal_code','\D','','g'),
        sort_order=position-1,active=true,updated_at=now()
      where id=location_id and professional_id=target_professional_id returning id into location_id;
      if location_id is null then raise exception 'Local de atendimento inválido'; end if;
    else
      insert into public.professional_service_locations(
        professional_id,name,address_line,address_number,address_complement,neighborhood,city,state_code,postal_code,sort_order,active
      ) values(
        target_professional_id,trim(item->>'name'),trim(item->>'address_line'),trim(item->>'address_number'),
        nullif(trim(item->>'address_complement'),''),nullif(trim(item->>'neighborhood'),''),trim(item->>'city'),
        upper(trim(item->>'state_code'))::char(2),regexp_replace(item->>'postal_code','\D','','g'),position-1,true
      ) returning id into location_id;
    end if;
    kept_ids:=array_append(kept_ids,location_id);
  end loop;

  delete from public.professional_service_locations
    where professional_id=target_professional_id and not(id=any(kept_ids));
  insert into public.professional_service_cities(professional_id,city,state_code,is_primary,active)
  select target_professional_id,city,state_code,
    (row_number() over(order by min(sort_order),city)=1 and not exists(
      select 1 from public.professional_service_cities current_city
      where current_city.professional_id=target_professional_id and current_city.active and current_city.is_primary
    )),true
    from public.professional_service_locations
    where professional_id=target_professional_id and active
    group by city,state_code
  on conflict(professional_id,city,state_code) do update set active=true;

  select * into first_location from public.professional_service_locations
    where professional_id=target_professional_id and active order by sort_order,id limit 1;
  if first_location.id is not null then
    update public.professional_profiles set
      address_line=first_location.address_line,address_number=first_location.address_number,
      address_complement=first_location.address_complement,neighborhood=first_location.neighborhood,
      city=first_location.city,state_code=first_location.state_code,postal_code=first_location.postal_code,updated_at=now()
      where id=target_professional_id;
  end if;

  return query select * from public.professional_service_locations
    where professional_id=target_professional_id and active order by sort_order,id;
end $$;

revoke all on function public.save_professional_service_locations_v2(uuid,jsonb) from public;
grant execute on function public.save_professional_service_locations_v2(uuid,jsonb) to authenticated;
