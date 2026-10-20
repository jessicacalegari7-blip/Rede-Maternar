-- Publicação exige somente nome, telefone, especialidade e endereço.
create or replace function public.refresh_premium_publication(target_professional_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  pp public.professional_profiles;
  contract public.premium_contracts;
  account_status public.account_status;
  org_status public.account_status;
  specialty_ok boolean:=false;
  location_ok boolean:=false;
  required_profile_ok boolean:=false;
  new_status text;
begin
  select * into pp from public.professional_profiles where id=target_professional_id;
  if pp.id is null then return 'not_found'; end if;
  select pc.* into contract from public.premium_contracts pc where pc.professional_id=pp.id order by pc.activated_at desc limit 1;
  select p.status into account_status from public.profiles p where p.id=pp.user_id;
  select o.status into org_status from public.organizations o where o.id=pp.organization_id;
  select exists(
    select 1 from public.professional_specialties ps
    join public.specialties s on s.id=ps.specialty_id
    where ps.professional_id=pp.id and s.active
  ) into specialty_ok;
  select exists(
    select 1 from public.professional_service_locations l
    where l.professional_id=pp.id and l.active
      and length(trim(l.name))>=2 and length(trim(l.address_line))>=2
      and coalesce(trim(l.address_number),'')<>'' and length(trim(l.city))>=2
      and l.state_code~'^[A-Z]{2}$'
  ) into location_ok;
  required_profile_ok:=coalesce(trim(pp.full_name),'')<>'' and coalesce(trim(pp.whatsapp),'')<>'';

  if contract.id is null or contract.status<>'active' or contract.valid_until<=now()
    or account_status<>'active' or org_status<>'active' then new_status:='rejected';
  elsif not required_profile_ok or not specialty_ok or not location_ok then new_status:='awaiting_completion';
  else new_status:='published'; end if;

  update public.professional_profiles set
    profile_completed=(required_profile_ok and specialty_ok and location_ok),
    marketplace_visible=(new_status='published'),updated_at=now()
  where id=pp.id and (
    profile_completed is distinct from (required_profile_ok and specialty_ok and location_ok)
    or marketplace_visible is distinct from (new_status='published')
  );
  if contract.id is not null then
    update public.premium_contracts set publication_status=new_status,updated_at=now()
    where id=contract.id and publication_status is distinct from new_status;
  end if;
  return new_status;
end $$;

-- NEW/OLD não possuem a coluna id em todas as tabelas deste gatilho.
create or replace function public.trigger_refresh_premium_publication()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  row_data jsonb;
  professional_id uuid;
begin
  row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  professional_id:=coalesce(nullif(row_data->>'professional_id','')::uuid,nullif(row_data->>'id','')::uuid);
  if professional_id is not null then perform public.refresh_premium_publication(professional_id); end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.refresh_premium_publication(uuid) from public;
grant execute on function public.refresh_premium_publication(uuid) to service_role;
notify pgrst, 'reload schema';
