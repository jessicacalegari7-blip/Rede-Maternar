create or replace function public.get_premium_order_for_confirmation(target_public_token uuid)
returns table(id uuid,user_id uuid,status text)
language sql
security definer
set search_path=''
as $$
  select po.id,po.user_id,po.status
  from public.premium_orders po
  where po.public_token=target_public_token
  limit 1
$$;

revoke all on function public.get_premium_order_for_confirmation(uuid) from public,anon,authenticated;
grant execute on function public.get_premium_order_for_confirmation(uuid) to service_role;
