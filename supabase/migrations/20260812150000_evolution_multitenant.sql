-- Evolution API: multi-tenant, múltiplas instâncias e caixa de entrada real.
alter table public.whatsapp_connections drop constraint if exists whatsapp_connections_organization_id_key;
alter table public.whatsapp_connections
  add column if not exists external_instance_id text,
  add column if not exists webhook_secret_hash text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists whatsapp_connections_org_instance_idx
  on public.whatsapp_connections(organization_id, instance_name);
create unique index if not exists whatsapp_connections_external_idx
  on public.whatsapp_connections(external_instance_id)
  where external_instance_id is not null;

alter table public.conversations
  add column if not exists whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete set null;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  phone_normalized text not null,
  email text,
  source text not null default 'manual',
  patient_id uuid references public.patient_profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,phone_normalized)
);
alter table public.contacts enable row level security;
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create policy "contacts organization manage" on public.contacts for all to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin())
  with check (public.is_organization_member(organization_id) or public.is_platform_admin());
grant select,insert,update on public.contacts to authenticated;
alter table public.conversations add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.conversation_messages
  add column if not exists whatsapp_connection_id uuid references public.whatsapp_connections(id) on delete set null,
  add column if not exists error_message text,
  add column if not exists raw_payload jsonb;

create unique index if not exists conversation_messages_external_unique_idx
  on public.conversation_messages(whatsapp_connection_id, external_message_id)
  where external_message_id is not null;
create index if not exists conversations_connection_chat_idx
  on public.conversations(whatsapp_connection_id, external_chat_id);

-- O navegador nunca cria/edita credenciais ou estado do provedor diretamente.
drop policy if exists "whatsapp connections managers only" on public.whatsapp_connections;
create policy "whatsapp connections organization read" on public.whatsapp_connections
  for select to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin());

revoke insert, update, delete on public.whatsapp_connections from authenticated;
revoke insert, update, delete on public.conversation_messages from authenticated;
grant select on public.whatsapp_connections, public.conversation_messages to authenticated;

create table if not exists public.evolution_webhook_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique(connection_id, event_key)
);
alter table public.evolution_webhook_events enable row level security;
create policy "webhook events admin read" on public.evolution_webhook_events
  for select to authenticated using (public.is_platform_admin());
revoke all on public.evolution_webhook_events from anon, authenticated;
grant select on public.evolution_webhook_events to authenticated;
