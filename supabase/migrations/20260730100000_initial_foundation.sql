-- Rede Maternar: fundação multiempresa com autenticação e RLS.
create extension if not exists pgcrypto;

create type public.account_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.organization_type as enum ('independent', 'clinic');
create type public.member_role as enum ('owner', 'admin', 'receptionist', 'financial', 'professional');
create type public.plan_code as enum ('free', 'marketplace', 'independent', 'clinic');
create type public.lead_status as enum ('new', 'first_contact_attempt', 'second_contact_attempt', 'future_contact', 'scheduled', 'completed', 'lost');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'in_service', 'completed', 'cancelled', 'no_show');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  phone text,
  avatar_url text,
  status public.account_status not null default 'pending',
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.organization_type not null,
  legal_name text,
  display_name text not null,
  tax_id text,
  plan public.plan_code not null default 'free',
  status public.account_status not null default 'pending',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  professional_registration text,
  bio text,
  whatsapp text,
  city text not null,
  state_code char(2) not null,
  neighborhood text,
  clinic_name text,
  accepts_online boolean not null default false,
  marketplace_visible boolean not null default false,
  verified boolean not null default false,
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_specialties (
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (professional_id, specialty_id)
);

create table public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  birth_date date,
  notes text,
  no_show_count integer not null default 0 check (no_show_count >= 0),
  appointment_count integer not null default 0 check (appointment_count >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patient_profiles(id) on delete set null,
  requested_professional_id uuid references public.professional_profiles(id) on delete set null,
  assigned_professional_id uuid references public.professional_profiles(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  source text not null default 'manual',
  status public.lead_status not null default 'new',
  next_contact_at timestamptz,
  last_message_at timestamptz,
  unread_messages integer not null default 0 check (unread_messages >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  is_return boolean not null default false,
  is_paid_return boolean not null default false,
  is_online boolean not null default false,
  price_cents integer not null default 0 check (price_cents >= 0),
  payment_method text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id) where active;
create index professional_profiles_marketplace_idx on public.professional_profiles(marketplace_visible, state_code, city, neighborhood);
create index patient_profiles_org_name_idx on public.patient_profiles(organization_id, full_name);
create index leads_org_status_idx on public.leads(organization_id, status, updated_at desc);
create index appointments_org_start_idx on public.appointments(organization_id, starts_at);
create index appointments_professional_start_idx on public.appointments(professional_id, starts_at);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger professional_profiles_set_updated_at before update on public.professional_profiles for each row execute function public.set_updated_at();
create trigger patient_profiles_set_updated_at before update on public.patient_profiles for each row execute function public.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;
create or replace function public.is_organization_member(target_organization_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members om where om.organization_id = target_organization_id and om.user_id = auth.uid() and om.active);
$$;
create or replace function public.can_manage_organization(target_organization_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
    select 1 from public.organization_members om
    where om.organization_id = target_organization_id and om.user_id = auth.uid() and om.active and om.role in ('owner', 'admin')
  );
$$;
create or replace function public.is_organization_creator(target_organization_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organizations o
    where o.id = target_organization_id and o.created_by = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.is_organization_creator(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.specialties enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_specialties enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read self or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy "profiles update self or admin" on public.profiles for update to authenticated using (id = auth.uid() or public.is_platform_admin()) with check (id = auth.uid() or public.is_platform_admin());

create policy "organizations read members" on public.organizations for select to authenticated using (public.is_organization_member(id) or public.is_platform_admin());
create policy "organizations create authenticated" on public.organizations for insert to authenticated with check (created_by = auth.uid());
create policy "organizations manage owners" on public.organizations for update to authenticated using (public.can_manage_organization(id)) with check (public.can_manage_organization(id));

create policy "members read same organization" on public.organization_members for select to authenticated using (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "members create owner bootstrap or manager" on public.organization_members for insert to authenticated with check (
  public.can_manage_organization(organization_id) or (
    user_id = auth.uid() and role = 'owner'
    and public.is_organization_creator(organization_id)
  )
);
create policy "members update organization" on public.organization_members for update to authenticated using (public.can_manage_organization(organization_id)) with check (public.can_manage_organization(organization_id));
create policy "members delete organization" on public.organization_members for delete to authenticated using (public.can_manage_organization(organization_id));

create policy "specialties public read" on public.specialties for select to anon, authenticated using (active or public.is_platform_admin());
create policy "specialties admin manage" on public.specialties for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "professional profiles public or member read" on public.professional_profiles for select to anon, authenticated using (marketplace_visible or public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "professional profiles members create" on public.professional_profiles for insert to authenticated with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "professional profiles members update" on public.professional_profiles for update to authenticated using (public.is_organization_member(organization_id) or public.is_platform_admin()) with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "professional profiles managers delete" on public.professional_profiles for delete to authenticated using (public.can_manage_organization(organization_id));

create policy "professional specialties public or member read" on public.professional_specialties for select to anon, authenticated using (
  exists (select 1 from public.professional_profiles pp where pp.id = professional_id and (pp.marketplace_visible or public.is_organization_member(pp.organization_id) or public.is_platform_admin()))
);
create policy "professional specialties members manage" on public.professional_specialties for all to authenticated using (
  exists (select 1 from public.professional_profiles pp where pp.id = professional_id and (public.is_organization_member(pp.organization_id) or public.is_platform_admin()))
) with check (
  exists (select 1 from public.professional_profiles pp where pp.id = professional_id and (public.is_organization_member(pp.organization_id) or public.is_platform_admin()))
);

create policy "patients organization read" on public.patient_profiles for select to authenticated using (user_id = auth.uid() or public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "patients organization create" on public.patient_profiles for insert to authenticated with check (created_by = auth.uid() and (public.is_organization_member(organization_id) or public.is_platform_admin()));
create policy "patients organization update" on public.patient_profiles for update to authenticated using (public.is_organization_member(organization_id) or public.is_platform_admin()) with check (public.is_organization_member(organization_id) or public.is_platform_admin());

create policy "leads organization manage" on public.leads for all to authenticated using (public.is_organization_member(organization_id) or public.is_platform_admin()) with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "appointments organization or patient read" on public.appointments for select to authenticated using (
  public.is_organization_member(organization_id) or public.is_platform_admin()
  or exists (select 1 from public.patient_profiles patient where patient.id = patient_id and patient.user_id = auth.uid())
);
create policy "appointments organization create" on public.appointments for insert to authenticated with check (created_by = auth.uid() and (public.is_organization_member(organization_id) or public.is_platform_admin()));
create policy "appointments organization update" on public.appointments for update to authenticated using (public.is_organization_member(organization_id) or public.is_platform_admin()) with check (public.is_organization_member(organization_id) or public.is_platform_admin());

create policy "audit organization read" on public.audit_logs for select to authenticated using (public.can_manage_organization(organization_id) or public.is_platform_admin());
create policy "audit authenticated insert" on public.audit_logs for insert to authenticated with check (
  actor_id = auth.uid() and (organization_id is null or public.is_organization_member(organization_id) or public.is_platform_admin())
);

-- Impede que o navegador eleve privilégios ou altere dados controlados pela plataforma.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
revoke update on public.organizations from authenticated;
grant update (legal_name, display_name, tax_id) on public.organizations to authenticated;
revoke update on public.professional_profiles from authenticated;
grant update (
  full_name, professional_registration, bio, whatsapp, city, state_code,
  neighborhood, clinic_name, accepts_online, marketplace_visible
) on public.professional_profiles to authenticated;

insert into public.specialties (name, slug) values
  ('Alergologia pediátrica', 'alergologia-pediatrica'),
  ('Cardiologia pediátrica', 'cardiologia-pediatrica'),
  ('Consultoria de amamentação', 'consultoria-de-amamentacao'),
  ('Dermatologia pediátrica', 'dermatologia-pediatrica'),
  ('Doula', 'doula'),
  ('Enfermagem obstétrica', 'enfermagem-obstetrica'),
  ('Endocrinologia pediátrica', 'endocrinologia-pediatrica'),
  ('Fisioterapia infantil', 'fisioterapia-infantil'),
  ('Fisioterapia pélvica', 'fisioterapia-pelvica'),
  ('Fonoaudiologia infantil', 'fonoaudiologia-infantil'),
  ('Ginecologia e obstetrícia', 'ginecologia-e-obstetricia'),
  ('Neonatologia', 'neonatologia'),
  ('Neuropsicologia infantil', 'neuropsicologia-infantil'),
  ('Neurologia pediátrica', 'neurologia-pediatrica'),
  ('Nutrição infantil', 'nutricao-infantil'),
  ('Nutrição materno-infantil', 'nutricao-materno-infantil'),
  ('Odontopediatria', 'odontopediatria'),
  ('Pediatria', 'pediatria'),
  ('Psicologia infantil', 'psicologia-infantil'),
  ('Psicologia perinatal', 'psicologia-perinatal'),
  ('Psicopedagogia', 'psicopedagogia'),
  ('Psiquiatria infantil', 'psiquiatria-infantil'),
  ('Terapia ocupacional infantil', 'terapia-ocupacional-infantil');
