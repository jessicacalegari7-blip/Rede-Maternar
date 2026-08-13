-- Correções consolidadas para operação real do CRM, ERP e Marketplace.
grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.patient_profiles to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update on public.financial_entries to authenticated;
grant select, insert, update on public.cash_sessions to authenticated;

alter table public.patient_profiles add column if not exists cpf text;
create unique index if not exists patient_profiles_org_cpf_unique on public.patient_profiles(organization_id,cpf) where cpf is not null;

create table if not exists public.patient_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.patient_records enable row level security;
drop policy if exists "patient records organization manage" on public.patient_records;
create policy "patient records organization manage" on public.patient_records for all to authenticated
using (public.is_organization_member(organization_id) or public.is_platform_admin())
with check (public.is_organization_member(organization_id) or public.is_platform_admin());
grant select,insert,update on public.patient_records to authenticated;

drop policy if exists "leads organization manage" on public.leads;
create policy "leads organization manage" on public.leads for all to authenticated
using (public.is_organization_member(organization_id) or public.is_platform_admin())
with check (public.is_organization_member(organization_id) or public.is_platform_admin());

-- Garante que todas as colunas editáveis do perfil possam ser persistidas.
grant update (full_name,professional_registration,bio,whatsapp,email,city,state_code,neighborhood,clinic_name,
accepts_online,website_url,instagram_handle,accepted_insurances,payment_methods,profile_completed,
profile_image_url,cover_image_url,office_video_url,gallery_urls,clinic_description,opening_hours,
postal_code,address_line,address_number,address_complement) on public.professional_profiles to authenticated;

create or replace function public.ensure_my_professional_profile() returns uuid
language plpgsql security definer set search_path='' as $$
declare org_id uuid; profile_id uuid; person_name text; org_name text;
begin
  select om.organization_id,o.display_name into org_id,org_name
  from public.organization_members om join public.organizations o on o.id=om.organization_id
  where om.user_id=auth.uid() and om.active limit 1;
  if org_id is null then raise exception 'Acesso sem organização vinculada'; end if;
  select id into profile_id from public.professional_profiles where organization_id=org_id and user_id=auth.uid() limit 1;
  if profile_id is not null then return profile_id; end if;
  select full_name into person_name from public.profiles where id=auth.uid();
  insert into public.professional_profiles(organization_id,user_id,full_name,city,state_code,clinic_name)
  values(org_id,auth.uid(),coalesce(person_name,org_name,'Profissional'),'Não informada','SP',org_name)
  returning id into profile_id;
  return profile_id;
end $$;
grant execute on function public.ensure_my_professional_profile() to authenticated;
