-- Checkout anual avulso do Perfil Premium MaterPlace via Asaas.
create table if not exists public.premium_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  tax_id_last4 char(4),
  product_code text not null default 'premium_annual' check (product_code='premium_annual'),
  product_name text not null default 'Perfil Premium MaterPlace',
  amount_cents integer not null check (amount_cents>0),
  currency char(3) not null default 'BRL' check (currency='BRL'),
  status text not null default 'creating' check (status in ('creating','pending','paid','canceled','expired','refunded','chargeback','failed')),
  asaas_checkout_id text unique,
  asaas_payment_id text,
  public_token uuid not null unique default gen_random_uuid(),
  paid_at timestamptz,
  canceled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists premium_orders_one_open_per_user_idx
  on public.premium_orders(user_id,product_code) where status in ('creating','pending','paid');
create index if not exists premium_orders_status_created_idx on public.premium_orders(status,created_at desc);
create index if not exists premium_orders_customer_email_idx on public.premium_orders(lower(customer_email));
create index if not exists premium_orders_asaas_payment_idx on public.premium_orders(asaas_payment_id) where asaas_payment_id is not null;

create table if not exists public.premium_contracts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.premium_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  plan public.plan_code not null default 'marketplace',
  status text not null default 'active' check (status in ('active','expired','canceled','refunded','chargeback')),
  publication_status text not null default 'awaiting_completion' check (publication_status in ('awaiting_completion','awaiting_approval','published','rejected')),
  activated_at timestamptz not null,
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists premium_contracts_status_expiry_idx on public.premium_contracts(status,valid_until);

create table if not exists public.asaas_webhook_events (
  id text primary key,
  event_type text not null,
  checkout_id text,
  payment_id text,
  external_reference text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received' check (processing_status in ('received','processing','processed','ignored','error')),
  attempts integer not null default 0,
  last_error text,
  payload jsonb not null
);
create index if not exists asaas_events_pending_idx on public.asaas_webhook_events(processing_status,received_at);
create index if not exists asaas_events_reference_idx on public.asaas_webhook_events(external_reference) where external_reference is not null;

alter table public.premium_orders enable row level security;
alter table public.premium_contracts enable row level security;
alter table public.asaas_webhook_events enable row level security;

create policy "premium order owner read" on public.premium_orders for select to authenticated
  using(user_id=auth.uid() or public.is_platform_admin());
create policy "premium contract owner read" on public.premium_contracts for select to authenticated
  using(user_id=auth.uid() or public.is_platform_admin());
create policy "asaas events admin read" on public.asaas_webhook_events for select to authenticated
  using(public.is_platform_admin());

grant select on public.premium_orders,public.premium_contracts to authenticated;
grant select on public.asaas_webhook_events to authenticated;

create or replace function public.find_checkout_user_by_email(target_email text)
returns table(user_id uuid,email text)
language sql security definer set search_path=''
as $$ select id,email::text from auth.users where lower(email)=lower(trim(target_email)) limit 1 $$;
revoke all on function public.find_checkout_user_by_email(text) from public;
grant execute on function public.find_checkout_user_by_email(text) to service_role;

create or replace function public.apply_asaas_order_event(
  target_order_id uuid,
  target_event_id text,
  target_event_type text,
  target_checkout_id text,
  target_payment_id text,
  target_amount_cents integer
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  target_order public.premium_orders;
  activation_time timestamptz:=now();
  result jsonb;
begin
  select * into target_order from public.premium_orders where id=target_order_id for update;
  if target_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if target_checkout_id is not null and target_order.asaas_checkout_id is distinct from target_checkout_id then
    raise exception 'Checkout não corresponde ao pedido';
  end if;

  if target_event_type='CHECKOUT_PAID' then
    if target_amount_cents is null or target_amount_cents<>target_order.amount_cents then raise exception 'Valor financeiro divergente'; end if;
    if target_order.status not in ('refunded','chargeback') then
      update public.premium_orders set status='paid',asaas_payment_id=coalesce(target_payment_id,asaas_payment_id),
        paid_at=coalesce(paid_at,activation_time),updated_at=activation_time where id=target_order.id;
      insert into public.premium_contracts(order_id,user_id,organization_id,professional_id,plan,status,publication_status,activated_at,valid_until)
      values(target_order.id,target_order.user_id,target_order.organization_id,target_order.professional_id,'marketplace','active','awaiting_completion',activation_time,activation_time+interval '1 year')
      on conflict(order_id) do update set status='active',updated_at=activation_time;
      insert into public.plan_subscriptions(organization_id,plan,status,billing_cycle,price_cents,provider,external_subscription_id,starts_at,ends_at)
      values(target_order.organization_id,'marketplace','active','annual',target_order.amount_cents,'asaas',target_order.asaas_checkout_id,activation_time,activation_time+interval '1 year')
      on conflict(organization_id) do update set plan='marketplace',status='active',billing_cycle='annual',price_cents=excluded.price_cents,
        provider='asaas',external_subscription_id=excluded.external_subscription_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=activation_time;
      update public.organizations set plan='marketplace',status='active',updated_at=activation_time where id=target_order.organization_id;
      update public.profiles set status='active',updated_at=activation_time where id=target_order.user_id;
      -- Pagamento libera a edição, mas publicação depende de perfil completo e aprovação.
      update public.professional_profiles set marketplace_visible=false,updated_at=activation_time where id=target_order.professional_id;
      insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
      values(target_order.organization_id,target_order.user_id,'premium_payment_confirmed','premium_order',target_order.id,
        jsonb_build_object('event_id',target_event_id,'checkout_id',target_order.asaas_checkout_id,'amount_cents',target_order.amount_cents));
    end if;
  elsif target_event_type in ('CHECKOUT_CANCELED','CHECKOUT_EXPIRED') and target_order.status in ('creating','pending') then
    update public.premium_orders set status=case when target_event_type='CHECKOUT_CANCELED' then 'canceled' else 'expired' end,
      canceled_at=case when target_event_type='CHECKOUT_CANCELED' then activation_time else canceled_at end,updated_at=activation_time where id=target_order.id;
  elsif target_event_type in ('PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_DELETED') then
    update public.premium_orders set status=case when target_event_type='PAYMENT_CHARGEBACK_REQUESTED' then 'chargeback' else 'refunded' end,
      updated_at=activation_time where id=target_order.id;
    update public.premium_contracts set status=case when target_event_type='PAYMENT_CHARGEBACK_REQUESTED' then 'chargeback' else 'refunded' end,
      updated_at=activation_time where order_id=target_order.id;
    update public.plan_subscriptions set status='cancelled',updated_at=activation_time where organization_id=target_order.organization_id;
  end if;

  select jsonb_build_object('order_id',id,'status',status,'user_id',user_id,'organization_id',organization_id)
    into result from public.premium_orders where id=target_order.id;
  return result;
end $$;

revoke all on function public.apply_asaas_order_event(uuid,text,text,text,text,integer) from public;
grant execute on function public.apply_asaas_order_event(uuid,text,text,text,text,integer) to service_role;

create or replace function public.sync_premium_publication_status()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  update public.premium_contracts set publication_status=case
    when new.marketplace_visible then 'published'
    when new.profile_completed then 'awaiting_approval'
    else 'awaiting_completion' end,updated_at=now()
  where professional_id=new.id and status='active';
  return new;
end $$;
drop trigger if exists professional_sync_premium_publication on public.professional_profiles;
create trigger professional_sync_premium_publication after update of profile_completed,marketplace_visible on public.professional_profiles
for each row when(old.profile_completed is distinct from new.profile_completed or old.marketplace_visible is distinct from new.marketplace_visible)
execute function public.sync_premium_publication_status();
notify pgrst,'reload schema';
