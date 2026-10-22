-- A integração existente sempre bloqueou checkout de produção. Portanto, os
-- registros históricos destas tabelas exclusivas do Asaas são comprovadamente
-- Sandbox. A partir desta migration, nenhuma origem implícita é aceita.
alter table public.premium_orders add column if not exists asaas_environment text;
alter table public.asaas_webhook_events add column if not exists asaas_environment text;

update public.premium_orders set asaas_environment='sandbox' where asaas_environment is null;
update public.asaas_webhook_events set asaas_environment='sandbox' where asaas_environment is null;

alter table public.premium_orders alter column asaas_environment set not null;
alter table public.asaas_webhook_events alter column asaas_environment set not null;

alter table public.premium_orders drop constraint if exists premium_orders_asaas_environment_check;
alter table public.premium_orders add constraint premium_orders_asaas_environment_check check(asaas_environment in ('sandbox','production'));
alter table public.asaas_webhook_events drop constraint if exists asaas_webhook_events_asaas_environment_check;
alter table public.asaas_webhook_events add constraint asaas_webhook_events_asaas_environment_check check(asaas_environment in ('sandbox','production'));

alter table public.premium_orders drop constraint if exists premium_orders_asaas_checkout_id_key;
create unique index if not exists premium_orders_environment_checkout_uidx
  on public.premium_orders(asaas_environment,asaas_checkout_id) where asaas_checkout_id is not null;

alter table public.asaas_webhook_events drop constraint if exists asaas_webhook_events_pkey;
alter table public.asaas_webhook_events add primary key(asaas_environment,id);
create index if not exists asaas_events_environment_reference_idx
  on public.asaas_webhook_events(asaas_environment,external_reference) where external_reference is not null;

drop function if exists public.create_premium_guest_order(text,text,text,text,integer,jsonb);
create function public.create_premium_guest_order(
  target_asaas_environment text,target_name text,target_email text,target_phone text,
  target_tax_id_last4 text,target_amount_cents integer,target_attribution jsonb default '{}'::jsonb
) returns table(order_id uuid,public_token uuid)
language plpgsql security definer set search_path='' as $$
declare selected_id uuid; selected_token uuid;
begin
  if target_asaas_environment not in ('sandbox','production') then raise exception 'Ambiente Asaas invalido'; end if;
  if target_amount_cents<>5999 then raise exception 'Valor de produto invalido'; end if;

  update public.premium_orders
  set status='expired',updated_at=now()
  where asaas_environment=target_asaas_environment
    and user_id is null
    and lower(customer_email)=lower(trim(target_email))
    and product_code='premium_annual'
    and status in ('creating','pending')
    and coalesce(expires_at,created_at+interval '2 hours')<=now();

  select po.id,po.public_token into selected_id,selected_token
  from public.premium_orders po
  where po.asaas_environment=target_asaas_environment
    and po.user_id is null
    and lower(po.customer_email)=lower(trim(target_email))
    and po.product_code='premium_annual'
    and po.status in ('creating','pending')
    and coalesce(po.expires_at,po.created_at+interval '2 hours')>now()
  order by po.created_at desc limit 1;

  if selected_id is null then
    insert into public.premium_orders(
      asaas_environment,customer_name,customer_email,customer_phone,tax_id_last4,amount_cents,status,attribution
    ) values(
      target_asaas_environment,trim(target_name),lower(trim(target_email)),regexp_replace(target_phone,'[^0-9]','','g'),
      right(regexp_replace(target_tax_id_last4,'[^0-9]','','g'),4),target_amount_cents,'creating',coalesce(target_attribution,'{}'::jsonb)
    ) returning id,premium_orders.public_token into selected_id,selected_token;
  end if;

  return query select selected_id,selected_token;
end $$;
revoke all on function public.create_premium_guest_order(text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_premium_guest_order(text,text,text,text,text,integer,jsonb) to service_role;

drop function if exists public.process_asaas_webhook_event(text,text,text,text,text,integer,jsonb);
create function public.process_asaas_webhook_event(
  target_asaas_environment text,target_event_id text,target_event_type text,
  target_checkout_id text,target_payment_id text,target_external_reference text,
  target_amount_cents integer,target_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  event_row public.asaas_webhook_events;
  order_id uuid;
  normalized_event_type text;
  result jsonb;
begin
  if target_asaas_environment not in ('sandbox','production') then
    return jsonb_build_object('ok',false,'error_code','invalid_environment');
  end if;
  if coalesce(trim(target_event_id),'')='' or coalesce(trim(target_event_type),'')='' then
    return jsonb_build_object('ok',false,'error_code','invalid_event');
  end if;

  insert into public.asaas_webhook_events(asaas_environment,id,event_type,checkout_id,payment_id,external_reference,payload,processing_status)
  values(target_asaas_environment,target_event_id,target_event_type,target_checkout_id,target_payment_id,target_external_reference,coalesce(target_payload,'{}'::jsonb),'received')
  on conflict(asaas_environment,id) do nothing;

  select * into event_row from public.asaas_webhook_events
  where asaas_environment=target_asaas_environment and id=target_event_id for update;
  if event_row.processing_status in ('processed','ignored') then
    return jsonb_build_object('ok',true,'duplicate',true,'event_id',target_event_id,'status',event_row.processing_status);
  end if;

  update public.asaas_webhook_events set processing_status='processing',attempts=attempts+1,last_error=null
  where asaas_environment=target_asaas_environment and id=target_event_id;

  if target_event_type not in ('CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_DELETED') then
    update public.asaas_webhook_events set processing_status='ignored',processed_at=now()
    where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',true,'ignored',true,'event_id',target_event_id);
  end if;

  normalized_event_type:=case when target_event_type='PAYMENT_CHARGEBACK_DISPUTE' then 'PAYMENT_CHARGEBACK_REQUESTED' else target_event_type end;

  if target_checkout_id is not null then
    select id into order_id from public.premium_orders where asaas_environment=target_asaas_environment and asaas_checkout_id=target_checkout_id;
  end if;
  if order_id is null and target_payment_id is not null then
    select id into order_id from public.premium_orders where asaas_environment=target_asaas_environment and asaas_payment_id=target_payment_id;
  end if;
  if order_id is null and target_external_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select id into order_id from public.premium_orders where asaas_environment=target_asaas_environment and id=target_external_reference::uuid;
  end if;

  if order_id is not null and target_checkout_id is not null
     and exists(select 1 from public.premium_orders where asaas_environment=target_asaas_environment and id=order_id and asaas_checkout_id is distinct from target_checkout_id) then
    if normalized_event_type in ('CHECKOUT_CREATED','CHECKOUT_CANCELED','CHECKOUT_EXPIRED') then
      update public.asaas_webhook_events set processing_status='ignored',processed_at=now(),last_error=null
      where asaas_environment=target_asaas_environment and id=target_event_id;
      return jsonb_build_object('ok',true,'ignored',true,'reason','superseded_checkout','event_id',target_event_id);
    end if;
    update public.asaas_webhook_events set processing_status='error',last_error='Checkout financeiro não corresponde ao pedido.'
    where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','checkout_mismatch','event_id',target_event_id);
  end if;

  if order_id is null then
    update public.asaas_webhook_events set processing_status='error',last_error='Evento sem pedido correspondente.'
    where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','order_not_found','event_id',target_event_id);
  end if;

  begin
    result:=public.apply_asaas_order_event(order_id,target_event_id,normalized_event_type,target_checkout_id,target_payment_id,target_amount_cents);
  exception when others then
    update public.asaas_webhook_events set processing_status='error',last_error=left(sqlerrm,1000)
    where asaas_environment=target_asaas_environment and id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','processing_failed','event_id',target_event_id);
  end;

  update public.asaas_webhook_events set processing_status='processed',processed_at=now(),last_error=null
  where asaas_environment=target_asaas_environment and id=target_event_id;
  return coalesce(result,'{}'::jsonb)||jsonb_build_object('ok',true,'duplicate',false,'event_id',target_event_id);
end $$;
revoke all on function public.process_asaas_webhook_event(text,text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.process_asaas_webhook_event(text,text,text,text,text,text,integer,jsonb) to service_role;

notify pgrst,'reload schema';
