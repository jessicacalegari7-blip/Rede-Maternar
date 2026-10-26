-- Harden the premium checkout without changing historical financial records.
-- Production creation remains guarded in application code and disabled by env.

drop index if exists public.premium_orders_guest_open_email_idx;
drop index if exists public.premium_orders_one_open_per_user_idx;
create unique index premium_orders_guest_open_email_idx
  on public.premium_orders(asaas_environment,lower(customer_email),product_code)
  where user_id is null and status in ('creating','pending','paid');
create unique index premium_orders_one_open_per_user_idx
  on public.premium_orders(asaas_environment,user_id,product_code)
  where user_id is not null and status in ('creating','pending','paid');

alter table public.premium_orders add column if not exists checkout_attempt_id uuid;
alter table public.premium_orders add column if not exists checkout_attempt_status text;
alter table public.premium_orders add column if not exists checkout_attempt_started_at timestamptz;
alter table public.premium_orders add column if not exists checkout_attempts integer not null default 0;
alter table public.premium_orders add column if not exists checkout_reconciliation_required boolean not null default false;
alter table public.premium_orders add column if not exists financial_state text not null default 'unpaid';
alter table public.premium_orders add column if not exists refunded_amount_cents integer not null default 0;
alter table public.premium_orders drop constraint if exists premium_orders_checkout_attempt_status_check;
alter table public.premium_orders add constraint premium_orders_checkout_attempt_status_check
  check(checkout_attempt_status is null or checkout_attempt_status in ('reserved','confirmed','failed','inconclusive'));
alter table public.premium_orders drop constraint if exists premium_orders_financial_state_check;
alter table public.premium_orders add constraint premium_orders_financial_state_check check(financial_state in
  ('unpaid','paid','refund_in_progress','partially_refunded','refunded','refund_denied','chargeback_requested','chargeback_dispute','chargeback_reversal_pending','restored'));

create table if not exists public.premium_financial_transitions(
  id bigint generated always as identity primary key,
  order_id uuid not null references public.premium_orders(id) on delete restrict,
  asaas_environment text not null check(asaas_environment in ('sandbox','production')),
  event_id text not null,
  event_type text not null,
  from_state text,
  to_state text not null,
  amount_cents integer,
  created_at timestamptz not null default now(),
  unique(asaas_environment,event_id)
);
alter table public.premium_financial_transitions enable row level security;
create policy "premium transitions admin read" on public.premium_financial_transitions for select to authenticated using(public.is_platform_admin());
grant select on public.premium_financial_transitions to authenticated;

create table if not exists public.premium_email_outbox(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.premium_orders(id) on delete cascade,
  purpose text not null default 'access_invite' check(purpose in ('access_invite')),
  status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id,purpose)
);
alter table public.premium_email_outbox enable row level security;
create policy "premium email outbox admin read" on public.premium_email_outbox for select to authenticated using(public.is_platform_admin());
grant select on public.premium_email_outbox to authenticated;
create index if not exists premium_email_outbox_ready_idx on public.premium_email_outbox(status,next_attempt_at);

create table if not exists public.premium_recovery_limits(
  identity_hash char(64) not null,
  ip_hash char(64) not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  primary key(identity_hash,ip_hash)
);
alter table public.premium_recovery_limits enable row level security;

create or replace function public.allow_premium_invite_recovery(target_identity_hash text,target_ip_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare row public.premium_recovery_limits; previous_attempt timestamptz;
begin
  select last_attempt_at into previous_attempt from public.premium_recovery_limits where identity_hash=target_identity_hash and ip_hash=target_ip_hash for update;
  if previous_attempt>now()-interval '5 minutes' then return false; end if;
  insert into public.premium_recovery_limits(identity_hash,ip_hash,attempts,last_attempt_at) values(target_identity_hash,target_ip_hash,1,now())
  on conflict(identity_hash,ip_hash) do update set
    attempts=case when public.premium_recovery_limits.window_started_at<now()-interval '24 hours' then 1 else public.premium_recovery_limits.attempts+1 end,
    window_started_at=case when public.premium_recovery_limits.window_started_at<now()-interval '24 hours' then now() else public.premium_recovery_limits.window_started_at end,
    last_attempt_at=now() returning * into row;
  return row.attempts<=5;
end $$;

create or replace function public.reserve_premium_checkout(
  target_asaas_environment text,target_name text,target_email text,target_phone text,
  target_tax_id_last4 text,target_amount_cents integer,target_attribution jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.premium_orders; attempt uuid;
begin
  if target_asaas_environment not in ('sandbox','production') or target_amount_cents<>5999 then raise exception 'Parametros financeiros invalidos'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_asaas_environment||':'||lower(trim(target_email))||':premium_annual',0));
  update public.premium_orders set status='expired',updated_at=now()
    where asaas_environment=target_asaas_environment and user_id is null and lower(customer_email)=lower(trim(target_email))
      and product_code='premium_annual' and status in ('creating','pending') and coalesce(expires_at,created_at+interval '2 hours')<=now();
  select * into po from public.premium_orders where asaas_environment=target_asaas_environment and user_id is null
    and lower(customer_email)=lower(trim(target_email)) and product_code='premium_annual' and status in ('creating','pending')
    and coalesce(expires_at,created_at+interval '2 hours')>now() order by created_at desc limit 1 for update;
  if po.id is null then
    insert into public.premium_orders(asaas_environment,customer_name,customer_email,customer_phone,tax_id_last4,amount_cents,status,attribution)
    values(target_asaas_environment,trim(target_name),lower(trim(target_email)),regexp_replace(target_phone,'[^0-9]','','g'),right(regexp_replace(target_tax_id_last4,'[^0-9]','','g'),4),target_amount_cents,'creating',coalesce(target_attribution,'{}'::jsonb)) returning * into po;
  end if;
  if po.asaas_checkout_id is not null and po.checkout_attempt_status='confirmed' then
    return jsonb_build_object('status','existing','order_id',po.id,'public_token',po.public_token,'checkout_id',po.asaas_checkout_id);
  end if;
  if po.checkout_attempt_status in ('reserved','inconclusive') and po.checkout_attempt_started_at>now()-interval '15 minutes' then
    return jsonb_build_object('status',po.checkout_attempt_status,'order_id',po.id,'public_token',po.public_token,'attempt_id',po.checkout_attempt_id);
  end if;
  if po.checkout_reconciliation_required then
    return jsonb_build_object('status','inconclusive','order_id',po.id,'public_token',po.public_token,'attempt_id',po.checkout_attempt_id);
  end if;
  attempt:=gen_random_uuid();
  update public.premium_orders set checkout_attempt_id=attempt,checkout_attempt_status='reserved',checkout_attempt_started_at=now(),checkout_attempts=checkout_attempts+1,updated_at=now() where id=po.id;
  return jsonb_build_object('status','reserved','order_id',po.id,'public_token',po.public_token,'attempt_id',attempt);
end $$;

create or replace function public.finish_premium_checkout_attempt(target_order_id uuid,target_attempt_id uuid,target_checkout_id text,target_result text,target_expires_at timestamptz default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if target_result not in ('confirmed','failed','inconclusive') then raise exception 'Resultado invalido'; end if;
  update public.premium_orders set
    checkout_attempt_status=target_result,
    checkout_reconciliation_required=(target_result='inconclusive'),
    asaas_checkout_id=case when target_result='confirmed' then target_checkout_id else asaas_checkout_id end,
    status=case when target_result='confirmed' then 'pending' when target_result='failed' then 'failed' else status end,
    expires_at=case when target_result='confirmed' then target_expires_at else expires_at end,updated_at=now()
  where id=target_order_id and checkout_attempt_id=target_attempt_id
    and (target_result<>'confirmed' or (target_checkout_id is not null and asaas_checkout_id is null));
  return found;
end $$;

create or replace function public.claim_premium_email_outbox(target_limit integer default 10)
returns setof public.premium_email_outbox language plpgsql security definer set search_path='' as $$
begin
  return query update public.premium_email_outbox o set status='processing',locked_at=now(),attempts=o.attempts+1,updated_at=now()
  where o.id in(select q.id from public.premium_email_outbox q where q.status in ('pending','failed') and q.next_attempt_at<=now() and q.attempts<8 order by q.next_attempt_at for update skip locked limit least(greatest(target_limit,1),25))
  returning o.*;
end $$;

create or replace function public.finish_premium_email_outbox(target_id uuid,target_status text,target_last_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if target_status not in ('sent','failed') then raise exception 'Status invalido'; end if;
  update public.premium_email_outbox set status=target_status,last_error=target_last_error,locked_at=null,
    next_attempt_at=case when target_status='failed' then now()+(interval '1 minute'*power(2,least(attempts,6))) else next_attempt_at end,updated_at=now()
  where id=target_id and status='processing';
end $$;

revoke all on function public.reserve_premium_checkout(text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
revoke all on function public.finish_premium_checkout_attempt(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.claim_premium_email_outbox(integer) from public,anon,authenticated;
revoke all on function public.finish_premium_email_outbox(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_premium_checkout(text,text,text,text,text,integer,jsonb) to service_role;
grant execute on function public.finish_premium_checkout_attempt(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.claim_premium_email_outbox(integer) to service_role;
grant execute on function public.finish_premium_email_outbox(uuid,text,text) to service_role;
revoke all on function public.allow_premium_invite_recovery(text,text) from public,anon,authenticated;
grant execute on function public.allow_premium_invite_recovery(text,text) to service_role;

create or replace function public.issue_premium_access_invite(target_order_id uuid,target_token_hash text,target_force boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.premium_orders; inv public.premium_access_invites;
begin
  select * into po from public.premium_orders where id=target_order_id and status='paid' for update;
  if po.id is null then return jsonb_build_object('should_send',false,'status','not_paid'); end if;
  select * into inv from public.premium_access_invites where order_id=po.id for update;
  if inv.id is not null and inv.used_at is not null then return jsonb_build_object('should_send',false,'status','used'); end if;
  if inv.id is not null and inv.email_status='sent' and not target_force then return jsonb_build_object('should_send',false,'status','already_sent'); end if;
  if inv.id is not null and inv.email_attempts>=8 then return jsonb_build_object('should_send',false,'status','attempt_limit'); end if;
  if target_force and inv.id is not null and inv.updated_at>now()-interval '5 minutes' then return jsonb_build_object('should_send',false,'status','rate_limited'); end if;
  insert into public.premium_access_invites(order_id,email,token_hash,expires_at,email_status,email_attempts,updated_at)
  values(po.id,po.customer_email,target_token_hash,now()+interval '48 hours','processing',1,now())
  on conflict(order_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,email_status='processing',email_attempts=public.premium_access_invites.email_attempts+1,last_error=null,updated_at=now()
  returning * into inv;
  return jsonb_build_object('should_send',true,'status','processing','invite_id',inv.id,'email',po.customer_email,'name',po.customer_name);
end $$;
revoke all on function public.issue_premium_access_invite(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.issue_premium_access_invite(uuid,text,boolean) to service_role;

create or replace function public.record_asaas_webhook_event(
  target_asaas_environment text,target_event_id text,target_event_type text,target_checkout_id text,
  target_payment_id text,target_external_reference text,target_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if target_asaas_environment not in ('sandbox','production') or coalesce(trim(target_event_id),'')='' then raise exception 'Evento invalido'; end if;
  insert into public.asaas_webhook_events(asaas_environment,id,event_type,checkout_id,payment_id,external_reference,payload,processing_status)
  values(target_asaas_environment,target_event_id,target_event_type,target_checkout_id,target_payment_id,target_external_reference,coalesce(target_payload,'{}'::jsonb),'received')
  on conflict(asaas_environment,id) do nothing;
  return (select jsonb_build_object('status',processing_status,'duplicate',processing_status in ('processed','ignored')) from public.asaas_webhook_events where asaas_environment=target_asaas_environment and id=target_event_id);
end $$;
revoke all on function public.record_asaas_webhook_event(text,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_asaas_webhook_event(text,text,text,text,text,text,jsonb) to service_role;

create or replace function public.apply_asaas_order_event(
  target_order_id uuid,target_event_id text,target_event_type text,target_checkout_id text,target_payment_id text,target_amount_cents integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.premium_orders; old_state text; new_state text; at_time timestamptz:=now(); payload jsonb; refund_cents integer:=0; may_restore boolean:=false;
begin
  select * into po from public.premium_orders where id=target_order_id for update;
  if po.id is null then raise exception 'Pedido nao encontrado'; end if;
  if target_checkout_id is not null and po.asaas_checkout_id is distinct from target_checkout_id then raise exception 'Checkout nao corresponde ao pedido'; end if;
  select e.payload into payload from public.asaas_webhook_events e where e.asaas_environment=po.asaas_environment and e.id=target_event_id;
  refund_cents:=coalesce(round((payload#>>'{payment,refundedValue}')::numeric*100)::integer,0);
  old_state:=po.financial_state;

  if target_event_type='CHECKOUT_PAID' then
    if target_amount_cents is null or target_amount_cents<>po.amount_cents then raise exception 'Valor financeiro divergente'; end if;
    if po.status not in ('refunded','chargeback') and po.financial_state in ('unpaid','paid') then
      new_state:='paid';
      update public.premium_orders set status='paid',financial_state='paid',asaas_payment_id=coalesce(target_payment_id,asaas_payment_id),paid_at=coalesce(paid_at,at_time),updated_at=at_time where id=po.id;
      insert into public.premium_email_outbox(order_id) values(po.id) on conflict(order_id,purpose) do nothing;
    end if;
  elsif target_event_type in ('PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_RESTORED') then
    may_restore:=po.financial_state in ('refund_denied','chargeback_reversal_pending','restored');
    if may_restore and target_amount_cents=po.amount_cents then
      new_state:='restored';
      update public.premium_orders set status='paid',financial_state='restored',updated_at=at_time where id=po.id;
      update public.premium_contracts set status='active',updated_at=at_time where order_id=po.id;
      if po.organization_id is not null then update public.plan_subscriptions set status='active',updated_at=at_time where organization_id=po.organization_id; end if;
    end if;
  elsif target_event_type='PAYMENT_PARTIALLY_REFUNDED' then
    new_state:='partially_refunded';
    update public.premium_orders set financial_state=new_state,refunded_amount_cents=greatest(refunded_amount_cents,refund_cents),updated_at=at_time where id=po.id;
  elsif target_event_type='PAYMENT_REFUND_IN_PROGRESS' then
    new_state:='refund_in_progress'; update public.premium_orders set financial_state=new_state,updated_at=at_time where id=po.id;
  elsif target_event_type='PAYMENT_REFUND_DENIED' then
    new_state:='refund_denied'; update public.premium_orders set financial_state=new_state,updated_at=at_time where id=po.id;
  elsif target_event_type='PAYMENT_REFUNDED' then
    new_state:='refunded';
    update public.premium_orders set status='refunded',financial_state=new_state,refunded_amount_cents=amount_cents,updated_at=at_time where id=po.id;
    update public.premium_contracts set status='refunded',updated_at=at_time where order_id=po.id;
    if po.organization_id is not null then update public.plan_subscriptions set status='cancelled',updated_at=at_time where organization_id=po.organization_id; end if;
  elsif target_event_type in ('PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE') then
    new_state:=case when target_event_type='PAYMENT_CHARGEBACK_DISPUTE' then 'chargeback_dispute' else 'chargeback_requested' end;
    update public.premium_orders set status='chargeback',financial_state=new_state,updated_at=at_time where id=po.id;
    update public.premium_contracts set status='chargeback',updated_at=at_time where order_id=po.id;
    if po.organization_id is not null then update public.plan_subscriptions set status='cancelled',updated_at=at_time where organization_id=po.organization_id; end if;
  elsif target_event_type='PAYMENT_AWAITING_CHARGEBACK_REVERSAL' then
    new_state:='chargeback_reversal_pending'; update public.premium_orders set financial_state=new_state,updated_at=at_time where id=po.id;
  elsif target_event_type='PAYMENT_DELETED' and po.status in ('creating','pending') then
    new_state:='unpaid'; update public.premium_orders set status='canceled',updated_at=at_time where id=po.id;
  elsif target_event_type in ('CHECKOUT_CANCELED','CHECKOUT_EXPIRED') and po.status in ('creating','pending') then
    update public.premium_orders set status=case when target_event_type='CHECKOUT_CANCELED' then 'canceled' else 'expired' end,updated_at=at_time where id=po.id;
  end if;

  if new_state is not null and new_state is distinct from old_state then
    insert into public.premium_financial_transitions(order_id,asaas_environment,event_id,event_type,from_state,to_state,amount_cents)
    values(po.id,po.asaas_environment,target_event_id,target_event_type,old_state,new_state,target_amount_cents) on conflict do nothing;
  end if;
  return (select jsonb_build_object('order_id',id,'status',status,'financial_state',financial_state,'user_id',user_id,'organization_id',organization_id) from public.premium_orders where id=po.id);
end $$;

create or replace function public.process_asaas_webhook_event(
  target_asaas_environment text,target_event_id text,target_event_type text,target_checkout_id text,target_payment_id text,
  target_external_reference text,target_amount_cents integer,target_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev public.asaas_webhook_events; oid uuid; result jsonb;
begin
  if target_asaas_environment not in ('sandbox','production') then return jsonb_build_object('ok',false,'error_code','invalid_environment'); end if;
  if coalesce(trim(target_event_id),'')='' or coalesce(trim(target_event_type),'')='' then return jsonb_build_object('ok',false,'error_code','invalid_event'); end if;
  insert into public.asaas_webhook_events(asaas_environment,id,event_type,checkout_id,payment_id,external_reference,payload,processing_status)
  values(target_asaas_environment,target_event_id,target_event_type,target_checkout_id,target_payment_id,target_external_reference,coalesce(target_payload,'{}'::jsonb),'received')
  on conflict(asaas_environment,id) do nothing;
  select * into ev from public.asaas_webhook_events where asaas_environment=target_asaas_environment and id=target_event_id for update;
  if ev.processing_status in ('processed','ignored') then return jsonb_build_object('ok',true,'duplicate',true,'status',ev.processing_status); end if;
  update public.asaas_webhook_events set processing_status='processing',attempts=attempts+1,last_error=null where asaas_environment=target_asaas_environment and id=target_event_id;
  if target_event_type not in ('CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_REFUND_IN_PROGRESS','PAYMENT_REFUND_DENIED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_AWAITING_CHARGEBACK_REVERSAL','PAYMENT_CONFIRMED','PAYMENT_RECEIVED','PAYMENT_RESTORED','PAYMENT_DELETED') then
    update public.asaas_webhook_events set processing_status='ignored',processed_at=now() where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',true,'ignored',true);
  end if;
  if target_checkout_id is not null then select id into oid from public.premium_orders where asaas_environment=target_asaas_environment and asaas_checkout_id=target_checkout_id; end if;
  if oid is null and target_payment_id is not null then select id into oid from public.premium_orders where asaas_environment=target_asaas_environment and asaas_payment_id=target_payment_id; end if;
  if oid is null and target_external_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then select id into oid from public.premium_orders where asaas_environment=target_asaas_environment and id=target_external_reference::uuid; end if;
  if oid is null then
    update public.asaas_webhook_events set processing_status='error',last_error='Evento sem pedido correspondente.' where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','order_not_found');
  end if;
  if target_checkout_id is not null and exists(select 1 from public.premium_orders where id=oid and asaas_checkout_id is distinct from target_checkout_id) then
    update public.asaas_webhook_events set processing_status='error',last_error='Checkout financeiro nao corresponde ao pedido.' where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','checkout_mismatch');
  end if;
  begin
    result:=public.apply_asaas_order_event(oid,target_event_id,target_event_type,target_checkout_id,target_payment_id,target_amount_cents);
  exception when others then
    update public.asaas_webhook_events set processing_status='error',last_error=left(sqlerrm,1000) where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','processing_failed');
  end;
  update public.asaas_webhook_events set processing_status='processed',processed_at=now(),last_error=null where asaas_environment=target_asaas_environment and id=target_event_id;
  return coalesce(result,'{}'::jsonb)||jsonb_build_object('ok',true,'duplicate',false);
end $$;

revoke all on function public.apply_asaas_order_event(uuid,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.process_asaas_webhook_event(text,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.apply_asaas_order_event(uuid,text,text,text,text,integer) to service_role;
grant execute on function public.process_asaas_webhook_event(text,text,text,text,text,text,integer,jsonb) to service_role;

notify pgrst,'reload schema';
