-- Modalidades explícitas, área geográfica sem endereço físico e edição centralizada de serviços.
alter table public.professional_profiles
  add column if not exists accepts_in_person boolean not null default true,
  add column if not exists accepts_home boolean not null default false;

alter table public.services alter column name drop not null;
alter table public.services alter column duration_minutes drop not null;
alter table public.services alter column price_cents drop not null;

create or replace function public.save_professional_service_area(target_professional_id uuid,target_city text,target_state_code text)
returns void language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; normalized_city text:=trim(coalesce(target_city,'')); normalized_state text:=upper(trim(coalesce(target_state_code,'')));
begin
  select * into profile from public.professional_profiles where id=target_professional_id;
  if profile.id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if not (public.is_organization_member(profile.organization_id) or public.is_platform_admin()) then raise exception 'Acesso negado ao perfil'; end if;
  if (normalized_city<>'' or normalized_state<>'') and (normalized_city='' or normalized_state!~'^[A-Z]{2}$') then raise exception 'Informe cidade e UF'; end if;
  delete from public.professional_service_cities where professional_id=target_professional_id and not location_managed;
  if normalized_city<>'' then
    insert into public.professional_service_cities(professional_id,city,state_code,is_primary,active,location_managed)
    values(target_professional_id,normalized_city,normalized_state::char(2),not exists(select 1 from public.professional_service_cities where professional_id=target_professional_id and active),true,false)
    on conflict(professional_id,city,state_code) do update set active=true,location_managed=false;
    update public.professional_profiles set city=normalized_city,state_code=normalized_state::char(2),updated_at=now() where id=target_professional_id and not accepts_in_person;
  end if;
end $$;

revoke all on function public.save_professional_service_area(uuid,text,text) from public,anon;
grant execute on function public.save_professional_service_area(uuid,text,text) to authenticated;

create or replace function public.save_professional_profile_services(target_professional_id uuid,service_rows jsonb)
returns setof public.services language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; item jsonb; service_id uuid; kept_ids uuid[]:='{}'; duration_value integer; price_value integer; modes text[];
begin
  select * into profile from public.professional_profiles where id=target_professional_id;
  if profile.id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if not (public.is_organization_member(profile.organization_id) or public.is_platform_admin()) then raise exception 'Acesso negado ao perfil'; end if;
  if jsonb_typeof(service_rows)<>'array' then raise exception 'Lista de serviços inválida'; end if;
  modes:=array_remove(array[case when profile.accepts_in_person then 'presencial' end,case when profile.accepts_home then 'domiciliar' end,case when profile.accepts_online then 'online' end],null);
  for item in select value from jsonb_array_elements(service_rows) loop
    if coalesce(trim(item->>'name'),'')='' and coalesce(trim(item->>'description'),'')='' and nullif(item->>'duration_minutes','') is null and nullif(item->>'price_cents','') is null then continue; end if;
    duration_value:=nullif(item->>'duration_minutes','')::integer; price_value:=nullif(item->>'price_cents','')::integer;
    if duration_value is not null and duration_value<1 then raise exception 'Tempo estimado inválido'; end if;
    if price_value is not null and price_value<0 then raise exception 'Valor inválido'; end if;
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

create or replace view public.marketplace_services with (security_invoker=false,security_barrier=true) as
select s.id,pp.id as professional_profile_id,s.name,s.description,s.duration_minutes,s.price_cents,s.attendance_modes,s.specialty,s.professional_name,s.professional_registration,s.city,s.neighborhood
from public.services s join public.organizations o on o.id=s.organization_id and o.status='active'
join public.professional_profiles pp on pp.organization_id=s.organization_id and pp.marketplace_visible and (s.professional_id is null or s.professional_id=pp.id)
where s.active and s.marketplace_visible;
revoke all on public.marketplace_services from public;
grant select on public.marketplace_services to anon,authenticated;

create or replace function public.refresh_premium_publication(target_professional_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare pp public.professional_profiles; contract public.premium_contracts; account_status public.account_status; org_status public.account_status; specialty_ok boolean:=false; location_ok boolean:=false; required_profile_ok boolean:=false; new_status text;
begin
  select * into pp from public.professional_profiles where id=target_professional_id;
  if pp.id is null then return 'not_found'; end if;
  select pc.* into contract from public.premium_contracts pc where pc.professional_id=pp.id order by pc.activated_at desc limit 1;
  select p.status into account_status from public.profiles p where p.id=pp.user_id;
  select o.status into org_status from public.organizations o where o.id=pp.organization_id;
  select exists(select 1 from public.professional_specialties ps join public.specialties s on s.id=ps.specialty_id where ps.professional_id=pp.id and s.active) into specialty_ok;
  if pp.accepts_online or pp.accepts_home then
    select exists(select 1 from public.professional_service_cities c where c.professional_id=pp.id and c.active and length(trim(c.city))>=2 and c.state_code~'^[A-Z]{2}$') into location_ok;
  else location_ok:=true; end if;
  required_profile_ok:=coalesce(trim(pp.full_name),'')<>'' and coalesce(trim(pp.whatsapp),'')<>'';
  if contract.id is null or contract.status<>'active' or contract.valid_until<=now() or account_status<>'active' or org_status<>'active' then new_status:='rejected';
  elsif not required_profile_ok or not specialty_ok or not location_ok then new_status:='awaiting_completion'; else new_status:='published'; end if;
  update public.professional_profiles set profile_completed=(required_profile_ok and specialty_ok and location_ok),marketplace_visible=(new_status='published'),updated_at=now() where id=pp.id and (profile_completed is distinct from (required_profile_ok and specialty_ok and location_ok) or marketplace_visible is distinct from (new_status='published'));
  if contract.id is not null then update public.premium_contracts set publication_status=new_status,updated_at=now() where id=contract.id and publication_status is distinct from new_status; end if;
  return new_status;
end $$;

create or replace view public.marketplace_professionals as
select pp.id,pp.full_name,pp.bio,pp.whatsapp,pp.email,pp.city,pp.state_code,pp.neighborhood,pp.clinic_name,pp.accepts_online,pp.verified,pp.rating,pp.review_count,pp.accepted_insurances,pp.payment_methods,o.plan::text as plan,
coalesce(array_agg(distinct s.name) filter(where s.id is not null),'{}') as specialties,pp.profile_image_url,pp.cover_image_url,pp.office_video_url,pp.gallery_urls,pp.clinic_description,pp.opening_hours,pp.website_url,pp.instagram_handle,pp.facebook_url,pp.tiktok_url,pp.office_video_urls,
coalesce((select array_agg(sc.city||', '||sc.state_code order by sc.is_primary desc,sc.city) from public.professional_service_cities sc where sc.professional_id=pp.id and sc.active),case when nullif(trim(pp.city),'') is not null then array[pp.city||', '||pp.state_code] else '{}'::text[] end) as visibility_cities,pp.public_slug,pp.accepts_in_person,pp.accepts_home
from public.professional_profiles pp join public.organizations o on o.id=pp.organization_id left join public.professional_specialties ps on ps.professional_id=pp.id left join public.specialties s on s.id=ps.specialty_id and s.active where pp.marketplace_visible and o.status='active' group by pp.id,o.plan;
grant select on public.marketplace_professionals to anon,authenticated,service_role;

notify pgrst,'reload schema';
