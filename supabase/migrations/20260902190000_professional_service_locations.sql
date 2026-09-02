create table if not exists public.professional_service_locations(
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  name text not null check(length(trim(name)) between 2 and 160),
  address_line text not null check(length(trim(address_line)) between 2 and 240),
  address_number text,address_complement text,neighborhood text,
  city text not null,state_code char(2) not null,postal_code text,
  sort_order integer not null default 0,active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists professional_service_locations_profile_idx on public.professional_service_locations(professional_id,active,sort_order);
alter table public.professional_service_locations enable row level security;
create policy "service locations public read" on public.professional_service_locations for select to anon,authenticated using(active or exists(select 1 from public.professional_profiles p where p.id=professional_id and (public.is_organization_member(p.organization_id) or public.is_platform_admin())));
create policy "service locations owner manage" on public.professional_service_locations for all to authenticated using(exists(select 1 from public.professional_profiles p where p.id=professional_id and (public.is_organization_member(p.organization_id) or public.is_platform_admin()))) with check(exists(select 1 from public.professional_profiles p where p.id=professional_id and (public.is_organization_member(p.organization_id) or public.is_platform_admin())));
grant select on public.professional_service_locations to anon,authenticated;
grant insert,update,delete on public.professional_service_locations to authenticated;
