alter table public.premium_orders alter column user_id drop not null;
alter table public.premium_orders alter column organization_id drop not null;
alter table public.premium_orders add column if not exists attribution jsonb not null default '{}'::jsonb;

create table if not exists public.premium_access_invites(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.premium_orders(id) on delete cascade,
  email text not null,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  email_status text not null default 'pending' check(email_status in ('pending','processing','sent','failed')),
  email_attempts integer not null default 0,
  email_sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.premium_access_invites enable row level security;

create unique index if not exists premium_orders_guest_open_email_idx
  on public.premium_orders(lower(customer_email),product_code)
  where user_id is null and status in ('creating','pending','paid');

create or replace function public.create_premium_guest_order(
  target_name text,target_email text,target_phone text,target_tax_id_last4 text,
  target_amount_cents integer,target_attribution jsonb default '{}'::jsonb
) returns table(order_id uuid,public_token uuid)
language plpgsql security definer set search_path='' as $$
declare selected_id uuid; selected_token uuid;
begin
  if target_amount_cents<>5999 then raise exception 'Valor de produto invalido'; end if;
  select po.id,po.public_token into selected_id,selected_token from public.premium_orders po
  where po.user_id is null and lower(po.customer_email)=lower(trim(target_email))
    and po.product_code='premium_annual' and po.status in ('creating','pending')
    and po.created_at>now()-interval '2 hours' order by po.created_at desc limit 1;
  if selected_id is null then
    insert into public.premium_orders(customer_name,customer_email,customer_phone,tax_id_last4,amount_cents,status,attribution)
    values(trim(target_name),lower(trim(target_email)),regexp_replace(target_phone,'[^0-9]','','g'),
      right(regexp_replace(target_tax_id_last4,'[^0-9]','','g'),4),target_amount_cents,'creating',coalesce(target_attribution,'{}'::jsonb))
    returning id,premium_orders.public_token into selected_id,selected_token;
  end if;
  return query select selected_id,selected_token;
end $$;
revoke all on function public.create_premium_guest_order(text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_premium_guest_order(text,text,text,text,integer,jsonb) to service_role;

create or replace function public.apply_asaas_order_event(
  target_order_id uuid,target_event_id text,target_event_type text,target_checkout_id text,target_payment_id text,target_amount_cents integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare target_order public.premium_orders; activation_time timestamptz:=now(); result jsonb;
begin
  select * into target_order from public.premium_orders where id=target_order_id for update;
  if target_order.id is null then raise exception 'Pedido não encontrado'; end if;
  if target_checkout_id is not null and target_order.asaas_checkout_id is distinct from target_checkout_id then raise exception 'Checkout não corresponde ao pedido'; end if;
  if target_event_type='CHECKOUT_PAID' then
    if target_amount_cents is null or target_amount_cents<>target_order.amount_cents then raise exception 'Valor financeiro divergente'; end if;
    if target_order.status not in ('refunded','chargeback') then
      update public.premium_orders set status='paid',asaas_payment_id=coalesce(target_payment_id,asaas_payment_id),paid_at=coalesce(paid_at,activation_time),updated_at=activation_time where id=target_order.id;
      if target_order.user_id is not null and target_order.organization_id is not null then
        insert into public.premium_contracts(order_id,user_id,organization_id,professional_id,plan,status,publication_status,activated_at,valid_until)
        values(target_order.id,target_order.user_id,target_order.organization_id,target_order.professional_id,'marketplace','active','awaiting_completion',activation_time,activation_time+interval '1 year')
        on conflict(order_id) do update set status='active',updated_at=activation_time;
        insert into public.plan_subscriptions(organization_id,plan,status,billing_cycle,price_cents,provider,external_subscription_id,starts_at,ends_at)
        values(target_order.organization_id,'marketplace','active','annual',target_order.amount_cents,'asaas',target_order.asaas_checkout_id,activation_time,activation_time+interval '1 year')
        on conflict(organization_id) do update set plan='marketplace',status='active',billing_cycle='annual',price_cents=excluded.price_cents,provider='asaas',external_subscription_id=excluded.external_subscription_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=activation_time;
        update public.organizations set plan='marketplace',status='active',updated_at=activation_time where id=target_order.organization_id;
        update public.profiles set status='active',updated_at=activation_time where id=target_order.user_id;
        update public.professional_profiles set marketplace_visible=false,updated_at=activation_time where id=target_order.professional_id;
      end if;
    end if;
  elsif target_event_type in ('CHECKOUT_CANCELED','CHECKOUT_EXPIRED') and target_order.status in ('creating','pending') then
    update public.premium_orders set status=case when target_event_type='CHECKOUT_CANCELED' then 'canceled' else 'expired' end,canceled_at=case when target_event_type='CHECKOUT_CANCELED' then activation_time else canceled_at end,updated_at=activation_time where id=target_order.id;
  elsif target_event_type in ('PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_DELETED') then
    update public.premium_orders set status=case when target_event_type='PAYMENT_CHARGEBACK_REQUESTED' then 'chargeback' else 'refunded' end,updated_at=activation_time where id=target_order.id;
    update public.premium_contracts set status=case when target_event_type='PAYMENT_CHARGEBACK_REQUESTED' then 'chargeback' else 'refunded' end,updated_at=activation_time where order_id=target_order.id;
    if target_order.organization_id is not null then update public.plan_subscriptions set status='cancelled',updated_at=activation_time where organization_id=target_order.organization_id; end if;
  end if;
  select jsonb_build_object('order_id',id,'status',status,'user_id',user_id,'organization_id',organization_id) into result from public.premium_orders where id=target_order.id;
  return result;
end $$;
revoke all on function public.apply_asaas_order_event(uuid,text,text,text,text,integer) from public;
grant execute on function public.apply_asaas_order_event(uuid,text,text,text,text,integer) to service_role;

create or replace function public.issue_premium_access_invite(target_order_id uuid,target_token_hash text,target_force boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.premium_orders; inv public.premium_access_invites;
begin
  select * into po from public.premium_orders where id=target_order_id and status='paid' for update;
  if po.id is null then return jsonb_build_object('should_send',false,'status','not_paid'); end if;
  select * into inv from public.premium_access_invites where order_id=po.id for update;
  if inv.id is not null and inv.used_at is not null then return jsonb_build_object('should_send',false,'status','used'); end if;
  if inv.id is not null and inv.email_status='sent' and not target_force then return jsonb_build_object('should_send',false,'status','already_sent'); end if;
  if target_force and inv.id is not null and inv.updated_at>now()-interval '5 minutes' then return jsonb_build_object('should_send',false,'status','rate_limited'); end if;
  insert into public.premium_access_invites(order_id,email,token_hash,expires_at,email_status,email_attempts,updated_at)
  values(po.id,po.customer_email,target_token_hash,now()+interval '48 hours','processing',1,now())
  on conflict(order_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,email_status='processing',email_attempts=public.premium_access_invites.email_attempts+1,last_error=null,updated_at=now()
  returning * into inv;
  return jsonb_build_object('should_send',true,'status','processing','invite_id',inv.id,'email',po.customer_email,'name',po.customer_name);
end $$;

create or replace function public.finish_premium_access_invite_email(target_invite_id uuid,target_status text,target_last_error text default null,target_provider_id text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if target_status not in ('sent','failed') then raise exception 'Status invalido'; end if;
  update public.premium_access_invites set email_status=target_status,last_error=target_last_error,provider_message_id=target_provider_id,email_sent_at=case when target_status='sent' then now() else email_sent_at end,updated_at=now() where id=target_invite_id and email_status='processing';
end $$;

create or replace function public.get_premium_access_invite(target_token_hash text)
returns table(email text,name text,phone text,existing_account boolean,expires_at timestamptz)
language sql security definer set search_path='' as $$
  select i.email,po.customer_name,po.customer_phone,exists(select 1 from auth.users u where lower(u.email)=lower(i.email)),i.expires_at
  from public.premium_access_invites i join public.premium_orders po on po.id=i.order_id
  where i.token_hash=target_token_hash and i.used_at is null and i.expires_at>now() and po.status='paid' limit 1
$$;

create or replace function public.redeem_premium_access_invite(target_token_hash text,target_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare inv public.premium_access_invites; po public.premium_orders; uid uuid:=target_user_id; org_id uuid; prof_id uuid; now_at timestamptz:=now();
begin
  select * into inv from public.premium_access_invites where token_hash=target_token_hash for update;
  if inv.id is null or inv.used_at is not null or inv.expires_at<=now_at then raise exception 'Convite invalido'; end if;
  select * into po from public.premium_orders where id=inv.order_id and status='paid' for update;
  if po.id is null then raise exception 'Pagamento nao confirmado'; end if;
  if not exists(select 1 from auth.users u where u.id=uid and lower(u.email)=lower(inv.email)) then raise exception 'Conta nao corresponde ao convite'; end if;
  insert into public.profiles(id,full_name,phone,status) values(uid,po.customer_name,po.customer_phone,'active') on conflict(id) do update set status='active',updated_at=now_at;
  select o.id into org_id from public.organizations o where o.created_by=uid order by o.created_at limit 1;
  if org_id is null then insert into public.organizations(type,display_name,plan,status,created_by) values('independent',po.customer_name,'marketplace','active',uid) returning id into org_id; end if;
  insert into public.organization_members(organization_id,user_id,role,active) values(org_id,uid,'owner',true) on conflict on constraint organization_members_pkey do update set active=true;
  select pp.id into prof_id from public.professional_profiles pp where pp.organization_id=org_id and pp.user_id=uid order by pp.created_at limit 1;
  if prof_id is null then insert into public.professional_profiles(organization_id,user_id,full_name,whatsapp,city,state_code,marketplace_visible) values(org_id,uid,po.customer_name,po.customer_phone,'Não informada','SP',false) returning id into prof_id; end if;
  update public.premium_orders set user_id=uid,organization_id=org_id,professional_id=prof_id,updated_at=now_at where id=po.id;
  insert into public.premium_contracts(order_id,user_id,organization_id,professional_id,plan,status,publication_status,activated_at,valid_until)
  values(po.id,uid,org_id,prof_id,'marketplace','active','awaiting_completion',coalesce(po.paid_at,now_at),coalesce(po.paid_at,now_at)+interval '1 year')
  on conflict(order_id) do update set user_id=uid,organization_id=org_id,professional_id=prof_id,status='active',updated_at=now_at;
  insert into public.plan_subscriptions(organization_id,plan,status,billing_cycle,price_cents,provider,external_subscription_id,starts_at,ends_at)
  values(org_id,'marketplace','active','annual',po.amount_cents,'asaas',po.asaas_checkout_id,coalesce(po.paid_at,now_at),coalesce(po.paid_at,now_at)+interval '1 year')
  on conflict(organization_id) do update set plan='marketplace',status='active',billing_cycle='annual',price_cents=excluded.price_cents,provider='asaas',external_subscription_id=excluded.external_subscription_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now_at;
  update public.organizations set plan='marketplace',status='active',updated_at=now_at where id=org_id;
  update public.premium_access_invites set used_at=now_at,updated_at=now_at where id=inv.id;
  return jsonb_build_object('ok',true,'status','active','user_id',uid,'organization_id',org_id,'professional_id',prof_id);
end $$;

revoke all on function public.issue_premium_access_invite(uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.finish_premium_access_invite_email(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.get_premium_access_invite(text) from public,anon,authenticated;
revoke all on function public.redeem_premium_access_invite(text,uuid) from public,anon,authenticated;
grant execute on function public.issue_premium_access_invite(uuid,text,boolean) to service_role;
grant execute on function public.finish_premium_access_invite_email(uuid,text,text,text) to service_role;
grant execute on function public.get_premium_access_invite(text) to service_role;
grant execute on function public.redeem_premium_access_invite(text,uuid) to service_role;
notify pgrst,'reload schema';
