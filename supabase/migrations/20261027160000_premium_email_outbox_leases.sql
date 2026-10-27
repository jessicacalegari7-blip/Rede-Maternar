-- Prepare durable Premium invite processing for a future Supabase Cron schedule.
-- This migration does not create or enable any recurring cron job.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

alter table public.premium_email_outbox add column if not exists lease_token uuid;
alter table public.premium_email_outbox add column if not exists delivery_key uuid default gen_random_uuid();
alter table public.premium_email_outbox add column if not exists provider_message_id text;
alter table public.premium_email_outbox drop constraint if exists premium_email_outbox_status_check;
alter table public.premium_email_outbox add constraint premium_email_outbox_status_check check(status in ('pending','processing','sent','failed','uncertain'));
update public.premium_email_outbox set delivery_key=gen_random_uuid() where delivery_key is null;
alter table public.premium_email_outbox alter column delivery_key set not null;

create index if not exists premium_email_outbox_expired_lease_idx
  on public.premium_email_outbox(locked_at)
  where status='processing';

create or replace function public.claim_premium_email_outbox(target_limit integer default 10)
returns setof public.premium_email_outbox language plpgsql security definer set search_path='' as $$
begin
  perform pg_try_advisory_xact_lock(hashtextextended('materplace:premium_email_outbox:claim',0));
  return query
  update public.premium_email_outbox o set
    status='processing',locked_at=now(),lease_token=gen_random_uuid(),attempts=o.attempts+1,last_error=null,updated_at=now()
  where o.id in(
    select q.id from public.premium_email_outbox q
    where (
      (q.status in ('pending','failed') and q.next_attempt_at<=now())
      or (q.status='processing' and q.locked_at<now()-interval '10 minutes')
    )
      and q.attempts<8
    order by coalesce(q.locked_at,q.next_attempt_at),q.created_at
    for update skip locked
    limit least(greatest(target_limit,1),25)
  )
  returning o.*;
end $$;

create or replace function public.finish_premium_email_outbox(
  target_id uuid,target_lease_token uuid,target_status text,target_last_error text default null,target_provider_id text default null
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if target_status not in ('sent','failed','uncertain') then raise exception 'Status invalido'; end if;
  update public.premium_email_outbox set
    status=target_status,last_error=left(target_last_error,300),provider_message_id=coalesce(target_provider_id,provider_message_id),
    locked_at=null,lease_token=null,
    next_attempt_at=case when target_status='failed' then now()+(interval '1 minute'*power(2,least(attempts,6))) else next_attempt_at end,
    updated_at=now()
  where id=target_id and status='processing' and lease_token=target_lease_token;
  return found;
end $$;

-- Compatibility wrapper for the existing daily Vercel job during the deployment transition.
create or replace function public.finish_premium_email_outbox(target_id uuid,target_status text,target_last_error text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if target_status not in ('sent','failed','uncertain') then raise exception 'Status invalido'; end if;
  update public.premium_email_outbox set status=target_status,last_error=left(target_last_error,300),locked_at=null,lease_token=null,
    next_attempt_at=case when target_status='failed' then now()+(interval '1 minute'*power(2,least(attempts,6))) else next_attempt_at end,updated_at=now()
  where id=target_id and status='processing' and locked_at>now()-interval '10 minutes';
end $$;

create or replace function public.issue_premium_access_invite(target_order_id uuid,target_token_hash text,target_force boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare po public.premium_orders; inv public.premium_access_invites;
begin
  select * into po from public.premium_orders where id=target_order_id and status='paid' for update;
  if po.id is null then return jsonb_build_object('should_send',false,'status','not_paid'); end if;
  select * into inv from public.premium_access_invites where order_id=po.id for update;
  if inv.id is not null and inv.used_at is not null then return jsonb_build_object('should_send',false,'status','used'); end if;
  if inv.id is not null and inv.email_status='sent' and not target_force then return jsonb_build_object('should_send',false,'status','already_sent'); end if;
  if inv.id is not null and inv.email_status='processing' and not target_force then return jsonb_build_object('should_send',false,'status','delivery_uncertain'); end if;
  if inv.id is not null and inv.email_attempts>=8 then return jsonb_build_object('should_send',false,'status','attempt_limit'); end if;
  if target_force and inv.id is not null and inv.updated_at>now()-interval '5 minutes' then return jsonb_build_object('should_send',false,'status','rate_limited'); end if;
  insert into public.premium_access_invites(order_id,email,token_hash,expires_at,email_status,email_attempts,updated_at)
  values(po.id,po.customer_email,target_token_hash,now()+interval '48 hours','processing',1,now())
  on conflict(order_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,email_status='processing',email_attempts=public.premium_access_invites.email_attempts+1,last_error=null,updated_at=now()
  returning * into inv;
  return jsonb_build_object('should_send',true,'status','processing','invite_id',inv.id,'email',po.customer_email,'name',po.customer_name);
end $$;

create or replace function public.resolve_premium_email_uncertain(target_id uuid,target_resolution text)
returns boolean language plpgsql security definer set search_path='' as $$
declare target_order_id uuid;
begin
  if target_resolution not in ('sent','retry') then raise exception 'Resolucao invalida'; end if;
  select order_id into target_order_id from public.premium_email_outbox where id=target_id and status='uncertain' for update;
  if target_order_id is null then return false; end if;
  if target_resolution='sent' then
    update public.premium_email_outbox set status='sent',last_error=null,updated_at=now() where id=target_id;
    update public.premium_access_invites set email_status='sent',email_sent_at=coalesce(email_sent_at,now()),updated_at=now() where order_id=target_order_id and email_status='processing';
  else
    update public.premium_email_outbox set status='failed',next_attempt_at=now(),last_error='manual_reconciliation_retry',updated_at=now() where id=target_id;
    update public.premium_access_invites set email_status='failed',last_error='manual_reconciliation_retry',updated_at=now() where order_id=target_order_id and email_status='processing';
  end if;
  return true;
end $$;
create or replace function public.premium_email_outbox_health()
returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'pending_over_15m',count(*) filter(where status in ('pending','failed') and created_at<now()-interval '15 minutes'),
    'expired_leases',count(*) filter(where status='processing' and locked_at<now()-interval '10 minutes'),
    'attempt_limit',count(*) filter(where status not in ('sent','uncertain') and attempts>=8),
    'delivery_uncertain',count(*) filter(where status='uncertain'),
    'processing',count(*) filter(where status='processing'),
    'ready',count(*) filter(where status in ('pending','failed') and next_attempt_at<=now() and attempts<8),
    'last_sent_at',max(updated_at) filter(where status='sent')
  ) from public.premium_email_outbox;
$$;

create or replace function public.dispatch_asaas_worker_once()
returns bigint language plpgsql security definer set search_path='' as $$
declare worker_secret text; request_id bigint;
begin
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name='asaas_worker_cron_secret' limit 1;
  if coalesce(worker_secret,'')='' then raise exception 'Worker cron secret is not configured in Vault'; end if;
  select net.http_get(
    url:='https://www.materplace.com.br/api/asaas-worker',
    headers:=jsonb_build_object('Authorization','Bearer '||worker_secret,'User-Agent','MaterPlace-Supabase-Cron/1.0'),
    timeout_milliseconds:=25000
  ) into request_id;
  return request_id;
end $$;

comment on function public.dispatch_asaas_worker_once() is 'Prepared for pg_cron; no recurring schedule is created by migrations.';

revoke all on function public.claim_premium_email_outbox(integer) from public,anon,authenticated;
revoke all on function public.finish_premium_email_outbox(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.finish_premium_email_outbox(uuid,text,text) from public,anon,authenticated;
revoke all on function public.premium_email_outbox_health() from public,anon,authenticated;
revoke all on function public.resolve_premium_email_uncertain(uuid,text) from public,anon,authenticated;
revoke all on function public.dispatch_asaas_worker_once() from public,anon,authenticated;
grant execute on function public.claim_premium_email_outbox(integer) to service_role;
grant execute on function public.finish_premium_email_outbox(uuid,uuid,text,text,text) to service_role;
grant execute on function public.finish_premium_email_outbox(uuid,text,text) to service_role;
grant execute on function public.premium_email_outbox_health() to service_role;
grant execute on function public.resolve_premium_email_uncertain(uuid,text) to service_role;
revoke all on function public.issue_premium_access_invite(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.issue_premium_access_invite(uuid,text,boolean) to service_role;

notify pgrst,'reload schema';
