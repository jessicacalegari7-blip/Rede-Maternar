create or replace function public.create_premium_guest_order(
  target_name text,target_email text,target_phone text,target_tax_id_last4 text,
  target_amount_cents integer,target_attribution jsonb default '{}'::jsonb
) returns table(order_id uuid,public_token uuid)
language plpgsql security definer set search_path='' as $$
declare selected_id uuid; selected_token uuid;
begin
  if target_amount_cents<>5999 then raise exception 'Valor de produto invalido'; end if;

  update public.premium_orders
  set status='expired',updated_at=now()
  where user_id is null
    and lower(customer_email)=lower(trim(target_email))
    and product_code='premium_annual'
    and status in ('creating','pending')
    and coalesce(expires_at,created_at+interval '2 hours')<=now();

  select po.id,po.public_token into selected_id,selected_token
  from public.premium_orders po
  where po.user_id is null
    and lower(po.customer_email)=lower(trim(target_email))
    and po.product_code='premium_annual'
    and po.status in ('creating','pending')
    and coalesce(po.expires_at,po.created_at+interval '2 hours')>now()
  order by po.created_at desc limit 1;

  if selected_id is null then
    insert into public.premium_orders(
      customer_name,customer_email,customer_phone,tax_id_last4,amount_cents,status,attribution
    ) values(
      trim(target_name),lower(trim(target_email)),regexp_replace(target_phone,'[^0-9]','','g'),
      right(regexp_replace(target_tax_id_last4,'[^0-9]','','g'),4),target_amount_cents,'creating',
      coalesce(target_attribution,'{}'::jsonb)
    ) returning id,premium_orders.public_token into selected_id,selected_token;
  end if;

  return query select selected_id,selected_token;
end $$;

revoke all on function public.create_premium_guest_order(text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.create_premium_guest_order(text,text,text,text,integer,jsonb) to service_role;
notify pgrst,'reload schema';
