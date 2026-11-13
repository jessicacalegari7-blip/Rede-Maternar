-- Atualiza apenas o preço aceito para novos checkouts. Pedidos e contratos
-- históricos preservam integralmente amount_cents e demais dados financeiros.
create or replace function public.reserve_premium_checkout(
  target_asaas_environment text,target_name text,target_email text,target_phone text,
  target_tax_id_last4 text,target_amount_cents integer,target_attribution jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.premium_orders; attempt uuid;
begin
  if target_asaas_environment not in ('sandbox','production') or target_amount_cents<>9990 then
    raise exception 'Parametros financeiros invalidos';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_asaas_environment||':'||lower(trim(target_email))||':premium_annual',0));

  -- Uma tentativa antiga, ainda não paga, nunca pode ser reutilizada com o novo preço.
  update public.premium_orders set status='expired',updated_at=now()
    where asaas_environment=target_asaas_environment and user_id is null
      and lower(customer_email)=lower(trim(target_email)) and product_code='premium_annual'
      and status in ('creating','pending') and amount_cents<>target_amount_cents;

  update public.premium_orders set status='expired',updated_at=now()
    where asaas_environment=target_asaas_environment and user_id is null and lower(customer_email)=lower(trim(target_email))
      and product_code='premium_annual' and status in ('creating','pending')
      and coalesce(expires_at,created_at+interval '2 hours')<=now();

  select * into po from public.premium_orders where asaas_environment=target_asaas_environment and user_id is null
    and lower(customer_email)=lower(trim(target_email)) and product_code='premium_annual'
    and amount_cents=target_amount_cents and status in ('creating','pending')
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

revoke all on function public.reserve_premium_checkout(text,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_premium_checkout(text,text,text,text,text,integer,jsonb) to service_role;
notify pgrst,'reload schema';
