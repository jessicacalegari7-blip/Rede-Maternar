-- Processa webhooks Asaas em uma única função privilegiada e idempotente.
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

  if target_external_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select id into order_id from public.premium_orders where id=target_external_reference::uuid;
  end if;
  if order_id is null and target_checkout_id is not null then
    select id into order_id from public.premium_orders where asaas_checkout_id=target_checkout_id;
  end if;
  if order_id is null and target_payment_id is not null then
    select id into order_id from public.premium_orders where asaas_payment_id=target_payment_id;
  end if;
  if order_id is null then
    update public.asaas_webhook_events set processing_status='error',last_error='Evento sem pedido correspondente.' where id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','order_not_found','event_id',target_event_id);
  end if;

  normalized_event_type:=case when target_event_type='PAYMENT_CHARGEBACK_DISPUTE' then 'PAYMENT_CHARGEBACK_REQUESTED' else target_event_type end;
  begin
    result:=public.apply_asaas_order_event(order_id,target_event_id,normalized_event_type,target_checkout_id,target_payment_id,target_amount_cents);
  exception when others then
    update public.asaas_webhook_events set processing_status='error',last_error=left(sqlerrm,1000) where id=target_event_id;
    return jsonb_build_object('ok',false,'error_code','processing_failed','event_id',target_event_id);
  end;

  update public.asaas_webhook_events set processing_status='processed',processed_at=now(),last_error=null where id=target_event_id;
  return coalesce(result,'{}'::jsonb)||jsonb_build_object('ok',true,'duplicate',false,'event_id',target_event_id);
end $$;

revoke all on function public.process_asaas_webhook_event(text,text,text,text,text,integer,jsonb) from public;
grant execute on function public.process_asaas_webhook_event(text,text,text,text,text,integer,jsonb) to service_role;

create or replace function public.record_premium_activation_email(
  target_user_id uuid,
  target_order_id uuid,
  target_status text,
  target_last_error text default null
) returns text
language plpgsql security definer set search_path=''
as $$
declare
  recipient_email text;
  notification_id uuid;
begin
  if target_status not in ('pending','sent','failed') then raise exception 'Status de e-mail inválido'; end if;
  select email::text into recipient_email from auth.users where id=target_user_id;
  if recipient_email is null then return 'recipient_missing'; end if;

  select id into notification_id from public.admin_email_notifications
  where event_type='premium_activated' and payload->>'order_id'=target_order_id::text
  order by created_at desc limit 1 for update;

  if notification_id is null then
    insert into public.admin_email_notifications(event_type,recipient,subject,payload,status,attempts,last_error,sent_at)
    values('premium_activated',recipient_email,'Seu Perfil Premium MaterPlace está ativo',
      jsonb_build_object('user_id',target_user_id,'order_id',target_order_id,'login_url','https://www.materplace.com.br/login','validity_months',12),
      target_status,case when target_status in ('sent','failed') then 1 else 0 end,target_last_error,case when target_status='sent' then now() else null end)
    returning id into notification_id;
  else
    update public.admin_email_notifications set status=target_status,
      attempts=attempts+case when target_status in ('sent','failed') then 1 else 0 end,
      last_error=target_last_error,sent_at=case when target_status='sent' then coalesce(sent_at,now()) else sent_at end
    where id=notification_id and status<>'sent';
  end if;
  return target_status;
end $$;

revoke all on function public.record_premium_activation_email(uuid,uuid,text,text) from public;
grant execute on function public.record_premium_activation_email(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
