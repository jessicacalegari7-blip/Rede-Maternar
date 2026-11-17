-- Fundação de marketing consentida. Nenhuma integração, cupom ou recuperação é ativada por esta migration.
create table if not exists public.marketing_funnel_events(
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null check(event_name in ('PageView','ViewContent','Lead','CompleteRegistration','InitiateCheckout','Purchase')),
  order_id uuid references public.premium_orders(id) on delete set null,
  source_url text,
  value_cents integer,
  currency char(3) check(currency is null or currency='BRL'),
  attribution jsonb not null default '{}'::jsonb,
  consent_granted boolean not null default false,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists marketing_funnel_order_idx on public.marketing_funnel_events(order_id,occurred_at);
create index if not exists marketing_funnel_name_time_idx on public.marketing_funnel_events(event_name,occurred_at desc);

create table if not exists public.marketing_event_outbox(
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique references public.marketing_funnel_events(event_id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lease_token uuid,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketing_outbox_ready_idx on public.marketing_event_outbox(next_attempt_at,created_at) where status in ('pending','failed');

create table if not exists public.marketing_coupons(
  id uuid primary key default gen_random_uuid(),
  code text not null unique check(code=upper(code) and code~'^[A-Z0-9_-]{4,32}$'),
  description text,
  discount_type text not null check(discount_type in ('percentage','fixed')),
  discount_value integer not null check(discount_value>0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check(usage_limit is null or usage_limit>0),
  per_identity_limit integer not null default 1 check(per_identity_limit>0),
  enabled boolean not null default false,
  eligibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(discount_type<>'percentage' or discount_value between 1 and 90)
);
create table if not exists public.marketing_coupon_redemptions(
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.marketing_coupons(id) on delete restrict,
  order_id uuid not null unique references public.premium_orders(id) on delete restrict,
  identity_hash text not null,
  discount_cents integer not null check(discount_cents>0),
  redeemed_at timestamptz not null default now(),
  unique(coupon_id,order_id)
);

create table if not exists public.marketing_recovery_queue(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.premium_orders(id) on delete cascade,
  stage text not null check(stage in ('registration_started','registration_completed','checkout_started','pix_pending')),
  sequence_step smallint not null check(sequence_step in (1,2)),
  status text not null default 'pending' check(status in ('pending','processing','sent','canceled','failed')),
  scheduled_at timestamptz not null,
  consent_granted boolean not null default false,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id,sequence_step)
);
create index if not exists marketing_recovery_ready_idx on public.marketing_recovery_queue(scheduled_at) where status in ('pending','failed');

alter table public.premium_orders add column if not exists list_amount_cents integer;
alter table public.premium_orders add column if not exists discount_cents integer not null default 0;
alter table public.premium_orders add column if not exists coupon_code text;
update public.premium_orders set list_amount_cents=amount_cents where list_amount_cents is null;
alter table public.premium_orders alter column list_amount_cents set not null;
alter table public.premium_orders drop constraint if exists premium_orders_discount_integrity;
alter table public.premium_orders add constraint premium_orders_discount_integrity check(discount_cents>=0 and amount_cents=list_amount_cents-discount_cents and amount_cents>0) not valid;

alter table public.marketing_funnel_events enable row level security;
alter table public.marketing_event_outbox enable row level security;
alter table public.marketing_coupons enable row level security;
alter table public.marketing_coupon_redemptions enable row level security;
alter table public.marketing_recovery_queue enable row level security;

create policy "marketing admin read events" on public.marketing_funnel_events for select to authenticated using(public.is_platform_admin());
create policy "marketing admin read outbox" on public.marketing_event_outbox for select to authenticated using(public.is_platform_admin());
create policy "marketing admin read coupons" on public.marketing_coupons for select to authenticated using(public.is_platform_admin());
create policy "marketing admin read redemptions" on public.marketing_coupon_redemptions for select to authenticated using(public.is_platform_admin());
create policy "marketing admin read recovery" on public.marketing_recovery_queue for select to authenticated using(public.is_platform_admin());
grant select on public.marketing_funnel_events,public.marketing_event_outbox,public.marketing_coupons,public.marketing_coupon_redemptions,public.marketing_recovery_queue to authenticated;

create or replace function public.queue_marketing_event(
  target_event_id text,target_event_name text,target_source_url text,target_order_id uuid,target_value_cents integer,
  target_currency text,target_user_data jsonb,target_custom_data jsonb,target_attribution jsonb,target_consent boolean
) returns boolean language plpgsql security definer set search_path='' as $$
declare inserted boolean:=false; event_time bigint:=extract(epoch from now())::bigint;
begin
  if target_consent is not true then return false; end if;
  if target_event_name not in ('PageView','ViewContent','Lead','CompleteRegistration','InitiateCheckout','Purchase') then raise exception 'Evento de marketing invalido'; end if;
  if coalesce(target_event_id,'')!~'^[A-Za-z0-9:_-]{12,180}$' then raise exception 'Identificador de evento invalido'; end if;
  insert into public.marketing_funnel_events(event_id,event_name,order_id,source_url,value_cents,currency,attribution,consent_granted)
  values(target_event_id,target_event_name,target_order_id,left(target_source_url,1000),target_value_cents,coalesce(target_currency,'BRL'),coalesce(target_attribution,'{}'::jsonb),true)
  on conflict(event_id) do nothing;
  inserted:=found;
  if inserted then
    insert into public.marketing_event_outbox(event_id,payload)
    values(target_event_id,jsonb_build_object('event_name',target_event_name,'event_time',event_time,'event_id',target_event_id,'event_source_url',left(target_source_url,1000),'action_source','website','user_data',coalesce(target_user_data,'{}'::jsonb),'custom_data',coalesce(target_custom_data,'{}'::jsonb)));
  end if;
  return inserted;
end $$;

create or replace function public.claim_marketing_event_outbox(target_limit integer default 10)
returns setof public.marketing_event_outbox language plpgsql security definer set search_path='' as $$
begin
  return query update public.marketing_event_outbox o set status='processing',locked_at=now(),lease_token=gen_random_uuid(),attempts=o.attempts+1,last_error=null,updated_at=now()
  where o.id in(select q.id from public.marketing_event_outbox q where ((q.status in ('pending','failed') and q.next_attempt_at<=now()) or (q.status='processing' and q.locked_at<now()-interval '10 minutes')) and q.attempts<8 order by q.next_attempt_at,q.created_at for update skip locked limit least(greatest(target_limit,1),25)) returning o.*;
end $$;

create or replace function public.finish_marketing_event_outbox(target_id uuid,target_lease_token uuid,target_status text,target_last_error text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if target_status not in ('sent','failed') then raise exception 'Status invalido'; end if;
  update public.marketing_event_outbox set status=target_status,last_error=left(target_last_error,200),locked_at=null,lease_token=null,sent_at=case when target_status='sent' then now() else sent_at end,next_attempt_at=case when target_status='failed' then now()+(interval '1 minute'*power(2,least(attempts,6))) else next_attempt_at end,updated_at=now()
  where id=target_id and status='processing' and lease_token=target_lease_token;
  return found;
end $$;

create or replace view public.marketing_funnel_state with(security_invoker=true) as
select po.id order_id,po.asaas_environment,po.status payment_status,po.financial_state,po.created_at,po.updated_at,po.paid_at,po.expires_at,
  exists(select 1 from public.marketing_funnel_events e where e.order_id=po.id and e.event_name='Lead') registration_completed,
  exists(select 1 from public.marketing_funnel_events e where e.order_id=po.id and e.event_name='InitiateCheckout') checkout_started,
  exists(select 1 from public.marketing_funnel_events e where e.order_id=po.id and e.event_name='Purchase') purchase_recorded,
  case when po.status='paid' then 'purchase_completed' when po.status='pending' and po.expires_at>now() then 'payment_pending' when po.status in ('expired','canceled','failed') then 'checkout_abandoned' else 'registration_in_progress' end funnel_stage
from public.premium_orders po;
revoke all on public.marketing_funnel_state from public,anon;
grant select on public.marketing_funnel_state to authenticated;

revoke all on function public.queue_marketing_event(text,text,text,uuid,integer,text,jsonb,jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.claim_marketing_event_outbox(integer) from public,anon,authenticated;
revoke all on function public.finish_marketing_event_outbox(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.queue_marketing_event(text,text,text,uuid,integer,text,jsonb,jsonb,jsonb,boolean) to service_role;
grant execute on function public.claim_marketing_event_outbox(integer) to service_role;
grant execute on function public.finish_marketing_event_outbox(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';

