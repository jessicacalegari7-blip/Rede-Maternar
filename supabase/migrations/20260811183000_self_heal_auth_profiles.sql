-- Repairs the link between Supabase Auth and legacy application profiles.
create or replace function public.ensure_current_user_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  current_metadata jsonb;
  repaired_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select raw_user_meta_data into current_metadata from auth.users where id = current_user_id;

  insert into public.profiles (id, full_name, phone, status, is_platform_admin)
  values (
    current_user_id,
    coalesce(nullif(trim(current_metadata ->> 'full_name'), ''), nullif(split_part(current_email, '@', 1), ''), 'Usuario MaterPlace'),
    nullif(trim(current_metadata ->> 'phone'), ''),
    case when current_email = 'jessica.calegari7@gmail.com' then 'active'::public.account_status else 'pending'::public.account_status end,
    current_email = 'jessica.calegari7@gmail.com'
  )
  on conflict (id) do nothing;

  update public.professional_profiles pp
  set user_id = current_user_id
  where pp.user_id is null
    and exists (select 1 from public.organizations o where o.id = pp.organization_id and o.created_by = current_user_id);

  insert into public.organization_members (organization_id, user_id, role, active)
  select distinct pp.organization_id, current_user_id, 'owner'::public.member_role, true
  from public.professional_profiles pp
  where pp.user_id = current_user_id
  on conflict (organization_id, user_id) do update set active = true;

  update public.profiles p
  set status = 'active'
  where p.id = current_user_id
    and exists (
      select 1 from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = current_user_id and om.active and o.status = 'active'
    );

  select * into repaired_profile from public.profiles where id = current_user_id;
  return repaired_profile;
end;
$$;

revoke all on function public.ensure_current_user_profile() from public;
grant execute on function public.ensure_current_user_profile() to authenticated;