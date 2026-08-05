create type public.financial_entry_type as enum ('receivable', 'payable', 'income', 'expense', 'tax', 'payroll');
create type public.financial_entry_status as enum ('pending', 'paid', 'overdue', 'cancelled');
create type public.whatsapp_connection_status as enum ('disconnected', 'connecting', 'connected', 'error');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  attendance_modes text[] not null default '{}',
  marketplace_visible boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  recurring_weekly boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patient_profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  type public.financial_entry_type not null,
  status public.financial_entry_status not null default 'pending',
  category text not null,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  due_date date,
  paid_at timestamptz,
  payment_method text,
  recurring boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  opening_balance_cents integer not null default 0,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  closing_balance_cents integer,
  notes text
);

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('meta_cloud', 'evolution')),
  instance_name text,
  phone_number text,
  status public.whatsapp_connection_status not null default 'disconnected',
  connected_at timestamptz,
  last_error text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  patient_id uuid references public.patient_profiles(id) on delete set null,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  phone text not null,
  body text not null,
  status text not null default 'queued',
  consent_basis text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create trigger services_set_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger financial_entries_set_updated_at before update on public.financial_entries for each row execute function public.set_updated_at();
create trigger whatsapp_connections_set_updated_at before update on public.whatsapp_connections for each row execute function public.set_updated_at();

alter table public.services enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.financial_entries enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "services public or organization read" on public.services for select using (
  (marketplace_visible and active) or public.is_organization_member(organization_id) or public.is_platform_admin()
);
create policy "services organization manage" on public.services for all to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin())
  with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "schedule blocks organization manage" on public.schedule_blocks for all to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin())
  with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "financial entries organization manage" on public.financial_entries for all to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin())
  with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "cash sessions organization manage" on public.cash_sessions for all to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin())
  with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "whatsapp connections managers only" on public.whatsapp_connections for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));
create policy "whatsapp messages organization read" on public.whatsapp_messages for select to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "whatsapp messages organization create" on public.whatsapp_messages for insert to authenticated
  with check (created_by = auth.uid() and (public.is_organization_member(organization_id) or public.is_platform_admin()));

create index services_org_idx on public.services(organization_id, active);
create index schedule_blocks_professional_idx on public.schedule_blocks(professional_id, starts_at);
create index financial_entries_org_due_idx on public.financial_entries(organization_id, status, due_date);
create index whatsapp_messages_org_created_idx on public.whatsapp_messages(organization_id, created_at desc);
