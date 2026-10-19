create or replace function public.process_asaas_webhook_event(
  target_event_id text,
  target_event_type text,
  target_checkout_id text,
  target_payment_id text,
  target_external_reference text,
  target_amount_cents integer,
  target_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  event_row public.asaas_webhook_events;
  order_id uuid;
  normalized_event_type text;
  result jsonb;
begin
  if coalesce(trim(target_event_id),'')='' or coalesce(trim(target_event_type),'')='' then
    return jsonb_build_object('ok',false,'error_code','invalid_event');
  end if;

  insert into public.asaas_webhook_events(id,event_type,checkout_id,payment_id,external_reference,payload,processing_status)
  values(target_event_id,target_event_type,target_checkout_id,target_payment_id,target_external_reference,coalesce(target_payload,'{}'::jsonb),'received')
  on conflict(id) do nothing;

  select * into event_row from public.asaas_webhook_events where id=target_event_id for update;
  if event_row.processing_status in ('processed','ignored') then
    return jsonb_build_object('ok',true,'duplicate',true,'event_id',target_event_id,'status',event_row.processing_status);
  end if;

  update public.asaas_webhook_events set processing_status='processing',attempts=attempts+1,last_error=null
  where id=target_event_id;

  if target_event_type not in ('CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE','PAYMENT_DELETED') then
    update public.asaas_webhook_events set processing_status='ignored',processed_at=now() where id=target_event_id;
    return jsonb_build_object('ok',true,'ignored',true,'event_id',target_event_id);
  end if;

  normalized_event_type:=case when target_event_type='PAYMENT_CHARGEBACK_DISPUTE' then 'PAYMENT_CHARGEBACK_REQUESTED' else target_event_type end;

  if target_checkout_id is not null then
    select id into order_id from public.premium_orders where asaas_checkout_id=target_checkout_id;
  end if;
  if order_id is null and target_payment_id is not null then
    select id into order_id from public.premium_orders where asaas_payment_id=target_payment_id;
  end if;
  if order_id is null and target_external_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select id into order_id from public.premium_orders where id=target_external_reference::uuid;
  end if;

  if order_id is not null and target_checkout_id is not null
     and exists(select 1 from public.premium_orders where id=order_id and asaas_checkout_id is distinct from target_checkout_id) then
    if normalized_event_type in ('CHECKOUT_CREATED','CHECKOUT_CANCELED','CHECKOUT_EXPIRED') then
      update public.asaas_webhook_events set processing_status='ignored',processed_at=now(),last_error=null where id=target_event_id;
      return jsonb_build_object('ok',true,'ignored',true,'reason','superseded_checkout','event_id',target_event_id);
    end if;
    update public.asaas_webhook_events set processing_status='error',last_error='Checkout financeiro não corresponde ao pedido.' where id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','checkout_mismatch','event_id',target_event_id);
  end if;

  if order_id is null then
    update public.asaas_webhook_events set processing_status='error',last_error='Evento sem pedido correspondente.' where id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','order_not_found','event_id',target_event_id);
  end if;

  begin
    result:=public.apply_asaas_order_event(order_id,target_event_id,normalized_event_type,target_checkout_id,target_payment_id,target_amount_cents);
  exception when others then
    update public.asaas_webhook_events set processing_status='error',last_error=left(sqlerrm,1000) where id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','processing_failed','event_id',target_event_id);
  end;

  update public.asaas_webhook_events set processing_status='processed',processed_at=now(),last_error=null where id=target_event_id;
  return coalesce(result,'{}'::jsonb)||jsonb_build_object('ok',true,'duplicate',false,'event_id',target_event_id);
end $$;

revoke all on function public.process_asaas_webhook_event(text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.process_asaas_webhook_event(text,text,text,text,text,integer,jsonb) to service_role;
notify pgrst,'reload schema';
