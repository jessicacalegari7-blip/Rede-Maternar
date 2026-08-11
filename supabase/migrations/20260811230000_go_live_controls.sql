create table if not exists public.professional_profile_views (
  id bigint generated always as identity primary key,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists professional_profile_views_profile_idx
  on public.professional_profile_views(professional_id, viewed_at desc);
alter table public.professional_profile_views enable row level security;

create or replace function public.record_professional_profile_view(target_professional_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists (
    select 1 from public.professional_profiles pp
    join public.organizations o on o.id=pp.organization_id
    where pp.id=target_professional_id and pp.marketplace_visible and o.status='active'
  ) then raise exception 'Perfil não publicado'; end if;
  insert into public.professional_profile_views(professional_id) values(target_professional_id);
end; $$;
grant execute on function public.record_professional_profile_view(uuid) to anon, authenticated;

create or replace function public.admin_list_profile_views()
returns table(professional_id uuid, view_count bigint)
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  return query select pp.id,count(pv.id) from public.professional_profiles pp
  left join public.professional_profile_views pv on pv.professional_id=pp.id group by pp.id;
end; $$;
grant execute on function public.admin_list_profile_views() to authenticated;

create or replace function public.my_profile_view_counts()
returns table(professional_id uuid,full_name text,view_count bigint)
language plpgsql security definer set search_path='' as $$
begin
  return query select pp.id,pp.full_name,count(pv.id)
  from public.professional_profiles pp
  left join public.professional_profile_views pv on pv.professional_id=pp.id
  where public.is_organization_member(pp.organization_id)
  group by pp.id,pp.full_name order by pp.full_name;
end; $$;
grant execute on function public.my_profile_view_counts() to authenticated;

create or replace function public.admin_set_organization_plan(target_organization_id uuid,new_plan public.plan_code)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  update public.organizations set plan=new_plan,updated_at=now() where id=target_organization_id;
  update public.plan_subscriptions set plan=new_plan,
    billing_cycle=case when new_plan='marketplace' then 'annual' else 'monthly' end,
    price_cents=case when new_plan='marketplace' then 5990 when new_plan='independent' then 9999 when new_plan='clinic' then 19999 else 0 end,
    updated_at=now() where organization_id=target_organization_id;
  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),target_organization_id,'organization_plan_changed','organization',target_organization_id,jsonb_build_object('new_plan',new_plan));
end; $$;
grant execute on function public.admin_set_organization_plan(uuid,public.plan_code) to authenticated;

create or replace function public.create_clinic_professional(professional_name text,professional_email text,specialty_name text,registration text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare org_id uuid; new_id uuid; specialty_id uuid; org_name text;
begin
  select o.id,o.display_name into org_id,org_name from public.organization_members om
  join public.organizations o on o.id=om.organization_id
  where om.user_id=auth.uid() and om.active and om.role in ('owner','admin') and o.plan='clinic' limit 1;
  if org_id is null then raise exception 'Somente administradores do plano Clínicas podem cadastrar profissionais'; end if;
  if exists(select 1 from public.professional_profiles where organization_id=org_id and lower(email)=lower(professional_email))
    then raise exception 'Já existe uma profissional com este e-mail'; end if;
  select id into specialty_id from public.specialties where active and lower(name)=lower(specialty_name) limit 1;
  if specialty_id is null then raise exception 'Especialidade não cadastrada'; end if;
  insert into public.professional_profiles(organization_id,full_name,email,professional_registration,city,state_code,clinic_name,marketplace_visible)
  select org_id,trim(professional_name),lower(trim(professional_email)),nullif(trim(registration),''),
    coalesce(pp.city,'Não informada'),coalesce(pp.state_code,'SP'),org_name,false
  from public.professional_profiles pp where pp.organization_id=org_id order by pp.created_at limit 1
  returning id into new_id;
  insert into public.professional_specialties(professional_id,specialty_id,is_primary) values(new_id,specialty_id,true);
  return new_id;
end; $$;
grant execute on function public.create_clinic_professional(text,text,text,text) to authenticated;

revoke update(marketplace_visible,verified) on public.professional_profiles from authenticated;
drop policy if exists "professional profiles members update" on public.professional_profiles;
create policy "professional profiles owner manager update" on public.professional_profiles for update to authenticated
using (user_id=auth.uid() or public.can_manage_organization(organization_id) or public.is_platform_admin())
with check (user_id=auth.uid() or public.can_manage_organization(organization_id) or public.is_platform_admin());
