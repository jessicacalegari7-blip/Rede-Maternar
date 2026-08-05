-- Completa o piloto real: acessos, assinaturas, conversas e diretório público.
create table if not exists public.plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan public.plan_code not null,
  status text not null default 'pending' check (status in ('pending','trial','active','past_due','cancelled')),
  billing_cycle text not null check (billing_cycle in ('monthly','annual')),
  price_cents integer not null check (price_cents >= 0),
  provider text,
  external_subscription_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patient_profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  channel text not null default 'internal' check (channel in ('internal','whatsapp_evolution','whatsapp_meta')),
  external_chat_id text,
  contact_name text not null,
  contact_phone text,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, external_chat_id)
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null check (char_length(trim(body)) > 0),
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  external_message_id text,
  consent_basis text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.professional_profiles
  add column if not exists email text,
  add column if not exists website_url text,
  add column if not exists instagram_handle text,
  add column if not exists postal_code text,
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists accepted_insurances text[] not null default '{}',
  add column if not exists payment_methods text[] not null default '{}',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists profile_completed boolean not null default false;

grant update (
  full_name, professional_registration, bio, whatsapp, city, state_code,
  neighborhood, clinic_name, accepts_online, marketplace_visible, email,
  website_url, instagram_handle, postal_code, address_line, address_number,
  address_complement, accepted_insurances, payment_methods, opening_hours,
  profile_completed
) on public.professional_profiles to authenticated;

create trigger plan_subscriptions_set_updated_at before update on public.plan_subscriptions
  for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create or replace function public.bootstrap_plan_subscription()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.plan_subscriptions(organization_id,plan,billing_cycle,price_cents,status)
  values (
    new.id,new.plan,
    case when new.plan='marketplace' then 'annual' else 'monthly' end,
    case when new.plan='marketplace' then 5990 when new.plan='independent' then 9999 when new.plan='clinic' then 19999 else 0 end,
    'pending'
  ) on conflict (organization_id) do nothing;
  return new;
end;
$$;
drop trigger if exists organization_bootstrap_subscription on public.organizations;
create trigger organization_bootstrap_subscription after insert on public.organizations
  for each row execute function public.bootstrap_plan_subscription();

insert into public.plan_subscriptions(organization_id,plan,billing_cycle,price_cents,status)
select o.id,o.plan,
  case when o.plan='marketplace' then 'annual' else 'monthly' end,
  case when o.plan='marketplace' then 5990 when o.plan='independent' then 9999 when o.plan='clinic' then 19999 else 0 end,
  case when o.status='active' then 'active' else 'pending' end
from public.organizations o on conflict (organization_id) do nothing;

update public.professional_profiles pp
set accepted_insurances = coalesce((
  select array(select jsonb_array_elements_text(coalesce(u.raw_user_meta_data->'insurances','[]'::jsonb)))
  from auth.users u where u.id=pp.user_id
),'{}');

alter table public.plan_subscriptions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "subscriptions organization read" on public.plan_subscriptions for select to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "subscriptions admin manage" on public.plan_subscriptions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "conversations organization manage" on public.conversations for all to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin())
  with check (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "messages organization read" on public.conversation_messages for select to authenticated
  using (public.is_organization_member(organization_id) or public.is_platform_admin());
create policy "messages organization insert" on public.conversation_messages for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and (public.is_organization_member(organization_id) or public.is_platform_admin())
  );

create index if not exists conversations_org_recent_idx
  on public.conversations(organization_id, last_message_at desc);
create index if not exists conversation_messages_conversation_idx
  on public.conversation_messages(conversation_id, created_at);

-- O e-mail definido pela proprietária é sempre administrador geral quando já existe no Auth.
update public.profiles p
set is_platform_admin = true, status = 'active'
from auth.users u
where p.id = u.id and lower(u.email) = 'jessica.calegari7@gmail.com';

create or replace function public.admin_platform_summary()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  select jsonb_build_object(
    'organizations', (select count(*) from public.organizations),
    'active_organizations', (select count(*) from public.organizations where status = 'active'),
    'pending_organizations', (select count(*) from public.organizations where status = 'pending'),
    'professionals', (select count(*) from public.professional_profiles),
    'patients', (select count(*) from public.patient_profiles),
    'appointments', (select count(*) from public.appointments),
    'prospects', (select count(*) from public.clinic_prospects),
    'pending_notifications', (select count(*) from public.admin_email_notifications where status <> 'sent')
  ) into result;
  return result;
end;
$$;
grant execute on function public.admin_platform_summary() to authenticated;

create or replace function public.admin_list_prospects()
returns setof public.clinic_prospects language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  return query select * from public.clinic_prospects order by created_at desc;
end;
$$;
grant execute on function public.admin_list_prospects() to authenticated;

create or replace view public.marketplace_professionals as
select
  pp.id, pp.full_name, pp.bio, pp.whatsapp, pp.email, pp.city, pp.state_code,
  pp.neighborhood, pp.clinic_name, pp.accepts_online, pp.verified, pp.rating,
  pp.review_count, pp.accepted_insurances, pp.payment_methods,
  o.plan::text as plan,
  coalesce(array_agg(distinct s.name) filter (where s.id is not null), '{}') as specialties
from public.professional_profiles pp
join public.organizations o on o.id = pp.organization_id
left join public.professional_specialties ps on ps.professional_id = pp.id
left join public.specialties s on s.id = ps.specialty_id
where pp.marketplace_visible and o.status = 'active'
group by pp.id, o.plan;
grant select on public.marketplace_professionals to anon, authenticated;
