-- Prepara a conta e registra o pedido Premium em uma unica transacao.
create or replace function public.create_premium_checkout_order(
  target_user_id uuid,
  target_name text,
  target_email text,
  target_phone text,
  target_tax_id_last4 text,
  target_amount_cents integer
) returns table(
  organization_id uuid,
  professional_id uuid,
  order_id uuid,
  public_token uuid
)
language plpgsql
security definer
set search_path=''
as $$
declare
  selected_organization_id uuid;
  selected_professional_id uuid;
  selected_order_id uuid;
  selected_public_token uuid;
begin
  if target_amount_cents <> 5999 then raise exception 'Valor de produto invalido'; end if;
  if not exists(
    select 1 from auth.users u
    where u.id=target_user_id and u.raw_user_meta_data->>'signup_source'='asaas_premium'
  ) then raise exception 'Usuario de checkout invalido'; end if;

  insert into public.profiles(id,full_name,phone)
  values(target_user_id,trim(target_name),nullif(trim(target_phone),''))
  on conflict(id) do nothing;

  select o.id into selected_organization_id
  from public.organizations o where o.created_by=target_user_id
  order by o.created_at limit 1;
  if selected_organization_id is null then
    insert into public.organizations(type,display_name,plan,status,created_by)
    values('independent',trim(target_name),'marketplace','pending',target_user_id)
    returning id into selected_organization_id;
  end if;

  insert into public.organization_members(organization_id,user_id,role,active)
  values(selected_organization_id,target_user_id,'owner',true)
  on conflict on constraint organization_members_pkey do update set active=true;

  select pp.id into selected_professional_id
  from public.professional_profiles pp
  where pp.organization_id=selected_organization_id and pp.user_id=target_user_id
  order by pp.created_at limit 1;
  if selected_professional_id is null then
    insert into public.professional_profiles(
      organization_id,user_id,full_name,whatsapp,city,state_code,marketplace_visible
    ) values(
      selected_organization_id,target_user_id,trim(target_name),nullif(trim(target_phone),''),
      'Não informada','SP',false
    ) returning id into selected_professional_id;
  end if;

  insert into public.premium_orders(
    user_id,organization_id,professional_id,customer_name,customer_email,
    customer_phone,tax_id_last4,amount_cents,status
  ) values(
    target_user_id,selected_organization_id,selected_professional_id,trim(target_name),
    lower(trim(target_email)),regexp_replace(target_phone,'[^0-9]','','g'),
    right(regexp_replace(target_tax_id_last4,'[^0-9]','','g'),4),target_amount_cents,'creating'
  ) returning id,premium_orders.public_token into selected_order_id,selected_public_token;

  return query select selected_organization_id,selected_professional_id,selected_order_id,selected_public_token;
end;
$$;

revoke all on function public.create_premium_checkout_order(uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.create_premium_checkout_order(uuid,text,text,text,text,integer) to service_role;

create or replace function public.update_premium_checkout_order(
  target_order_id uuid,
  target_status text,
  target_checkout_id text default null,
  target_expires_at timestamptz default null
) returns void
language plpgsql security definer set search_path=''
as $$
begin
  if target_status not in ('pending','failed') then raise exception 'Status de checkout invalido'; end if;
  if target_status='pending' and nullif(trim(target_checkout_id),'') is null then raise exception 'Checkout Asaas obrigatorio'; end if;
  update public.premium_orders set
    status=target_status,
    asaas_checkout_id=coalesce(target_checkout_id,asaas_checkout_id),
    expires_at=coalesce(target_expires_at,expires_at),
    updated_at=now()
  where id=target_order_id;
end;
$$;
revoke all on function public.update_premium_checkout_order(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.update_premium_checkout_order(uuid,text,text,timestamptz) to service_role;

create or replace function public.get_premium_checkout_status(target_public_token uuid)
returns table(status text,product_name text,amount_cents integer,paid_at timestamptz,expires_at timestamptz)
language sql security definer set search_path=''
as $$
  select po.status,po.product_name,po.amount_cents,po.paid_at,po.expires_at
  from public.premium_orders po where po.public_token=target_public_token limit 1
$$;
revoke all on function public.get_premium_checkout_status(uuid) from public,anon,authenticated;
grant execute on function public.get_premium_checkout_status(uuid) to service_role;
