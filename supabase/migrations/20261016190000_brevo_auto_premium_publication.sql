-- E-mail transacional idempotente e publicação automática segura do Perfil Premium.
alter table public.admin_email_notifications add column if not exists updated_at timestamptz not null default now();

create unique index if not exists premium_activation_email_order_unique
on public.admin_email_notifications((payload->>'order_id')) where event_type='premium_activated';

create or replace function public.claim_premium_activation_email(target_user_id uuid,target_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare notification public.admin_email_notifications;
begin
  select * into notification from public.admin_email_notifications
  where event_type='premium_activated' and payload->>'order_id'=target_order_id::text for update;
  if notification.id is null then
    insert into public.admin_email_notifications(event_type,recipient,subject,payload,status,attempts,updated_at)
    select 'premium_activated',u.email::text,'Pagamento aprovado — Seu Perfil Premium MaterPlace está liberado!',
      jsonb_build_object('user_id',target_user_id,'order_id',target_order_id,'validity_months',12),'processing',1,now()
    from auth.users u where u.id=target_user_id returning * into notification;
    if notification.id is null then return jsonb_build_object('should_send',false,'status','recipient_missing'); end if;
    return jsonb_build_object('should_send',true,'status','processing','notification_id',notification.id);
  end if;
  if notification.status='sent' or (notification.status='processing' and notification.updated_at>now()-interval '10 minutes') then
    return jsonb_build_object('should_send',false,'status',notification.status,'notification_id',notification.id);
  end if;
  if notification.attempts>=5 then return jsonb_build_object('should_send',false,'status','failed','notification_id',notification.id); end if;
  update public.admin_email_notifications set status='processing',attempts=attempts+1,last_error=null,updated_at=now() where id=notification.id;
  return jsonb_build_object('should_send',true,'status','processing','notification_id',notification.id);
end $$;

create or replace function public.claim_premium_confirmation_resend(target_user_id uuid,target_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare notification public.admin_email_notifications;
begin
  select * into notification from public.admin_email_notifications
  where event_type='premium_confirmation_resend' and payload->>'order_id'=target_order_id::text for update;
  if notification.id is not null and notification.status='processing' and notification.updated_at>now()-interval '10 minutes' then
    return jsonb_build_object('should_send',false,'status','processing');
  end if;
  if notification.id is not null and notification.updated_at>now()-interval '5 minutes' then
    return jsonb_build_object('should_send',false,'status','rate_limited');
  end if;
  if notification.id is null then
    insert into public.admin_email_notifications(event_type,recipient,subject,payload,status,attempts,updated_at)
    select 'premium_confirmation_resend',u.email::text,'Confirme seu e-mail — MaterPlace',jsonb_build_object('user_id',target_user_id,'order_id',target_order_id),'processing',1,now()
    from auth.users u where u.id=target_user_id returning * into notification;
  else
    update public.admin_email_notifications set status='processing',attempts=attempts+1,last_error=null,updated_at=now() where id=notification.id returning * into notification;
  end if;
  return jsonb_build_object('should_send',notification.id is not null,'status','processing','notification_id',notification.id);
end $$;

create or replace function public.finish_premium_activation_email(target_notification_id uuid,target_status text,target_last_error text default null,target_provider_id text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if target_status not in ('sent','failed') then raise exception 'Status de e-mail inválido'; end if;
  update public.admin_email_notifications set status=target_status,last_error=target_last_error,
    sent_at=case when target_status='sent' then now() else sent_at end,updated_at=now(),
    payload=payload||case when target_provider_id is null then '{}'::jsonb else jsonb_build_object('provider','brevo','provider_message_id',target_provider_id) end
  where id=target_notification_id and status='processing';
end $$;

revoke all on function public.claim_premium_activation_email(uuid,uuid) from public;
revoke all on function public.claim_premium_confirmation_resend(uuid,uuid) from public;
revoke all on function public.finish_premium_activation_email(uuid,text,text,text) from public;
grant execute on function public.claim_premium_activation_email(uuid,uuid) to service_role;
grant execute on function public.claim_premium_confirmation_resend(uuid,uuid) to service_role;
grant execute on function public.finish_premium_activation_email(uuid,text,text,text) to service_role;

create or replace function public.refresh_premium_publication(target_professional_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare pp public.professional_profiles; contract public.premium_contracts; account_status public.account_status; org_status public.account_status;
  email_verified boolean:=false; specialty_ok boolean:=false; location_ok boolean:=false; credential_ok boolean:=false; new_status text;
begin
  select * into pp from public.professional_profiles where id=target_professional_id;
  if pp.id is null then return 'not_found'; end if;
  select pc.* into contract from public.premium_contracts pc where pc.professional_id=pp.id order by pc.activated_at desc limit 1;
  select p.status into account_status from public.profiles p where p.id=pp.user_id;
  select o.status into org_status from public.organizations o where o.id=pp.organization_id;
  select exists(select 1 from auth.users u where u.id=pp.user_id and u.email_confirmed_at is not null) into email_verified;
  select exists(select 1 from public.professional_specialties ps join public.specialties s on s.id=ps.specialty_id where ps.professional_id=pp.id and s.active) into specialty_ok;
  select exists(select 1 from public.professional_service_locations l where l.professional_id=pp.id and l.active
    and length(trim(l.name))>=2 and length(trim(l.address_line))>=2 and coalesce(trim(l.address_number),'')<>''
    and length(trim(l.city))>=2 and l.state_code~'^[A-Z]{2}$' and regexp_replace(coalesce(l.postal_code,''),'\D','','g')~'^[0-9]{8}$') into location_ok;
  credential_ok:=coalesce(trim(pp.professional_registration),'')~'^[[:alnum:]][[:alnum:] .\-\/]{2,39}$';

  if contract.id is null or contract.status<>'active' or contract.valid_until<=now() or account_status<>'active' or org_status<>'active' then new_status:='rejected';
  elsif not email_verified or not pp.profile_completed or not specialty_ok or not location_ok then new_status:='awaiting_completion';
  elsif not credential_ok then new_status:='awaiting_approval';
  else new_status:='published'; end if;

  update public.professional_profiles set marketplace_visible=(new_status='published'),updated_at=now()
  where id=pp.id and marketplace_visible is distinct from (new_status='published');
  if contract.id is not null then update public.premium_contracts set publication_status=new_status,updated_at=now()
    where id=contract.id and publication_status is distinct from new_status; end if;
  return new_status;
end $$;
revoke all on function public.refresh_premium_publication(uuid) from public;
grant execute on function public.refresh_premium_publication(uuid) to service_role;

create or replace function public.trigger_refresh_premium_publication() returns trigger language plpgsql security definer set search_path='' as $$
declare professional_id uuid;
begin
  professional_id:=case when tg_table_name='professional_profiles' then coalesce(new.id,old.id)
    when tg_table_name='premium_contracts' then coalesce(new.professional_id,old.professional_id)
    else coalesce(new.professional_id,old.professional_id) end;
  if professional_id is not null then perform public.refresh_premium_publication(professional_id); end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists professional_sync_premium_publication on public.professional_profiles;
drop trigger if exists premium_profile_auto_publication on public.professional_profiles;
create trigger premium_profile_auto_publication after update of profile_completed,full_name,professional_registration,whatsapp on public.professional_profiles
for each row execute function public.trigger_refresh_premium_publication();
drop trigger if exists premium_specialty_auto_publication on public.professional_specialties;
create trigger premium_specialty_auto_publication after insert or update or delete on public.professional_specialties
for each row execute function public.trigger_refresh_premium_publication();
drop trigger if exists premium_location_auto_publication on public.professional_service_locations;
create trigger premium_location_auto_publication after insert or update or delete on public.professional_service_locations
for each row execute function public.trigger_refresh_premium_publication();
drop trigger if exists premium_contract_auto_publication on public.premium_contracts;
create trigger premium_contract_auto_publication after insert or update of status,valid_until on public.premium_contracts
for each row execute function public.trigger_refresh_premium_publication();

create or replace function public.refresh_publication_after_auth_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
declare professional_id uuid;
begin
  if old.email_confirmed_at is distinct from new.email_confirmed_at then
    for professional_id in select pp.id from public.professional_profiles pp where pp.user_id=new.id loop
      perform public.refresh_premium_publication(professional_id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists auth_email_confirmation_publication on auth.users;
create trigger auth_email_confirmation_publication after update of email_confirmed_at on auth.users
for each row execute function public.refresh_publication_after_auth_confirmation();

create or replace function public.refresh_publication_after_account_status() returns trigger language plpgsql security definer set search_path='' as $$
declare professional_id uuid;
begin
  if tg_table_name='profiles' then
    for professional_id in select pp.id from public.professional_profiles pp where pp.user_id=new.id loop perform public.refresh_premium_publication(professional_id); end loop;
  else
    for professional_id in select pp.id from public.professional_profiles pp where pp.organization_id=new.id loop perform public.refresh_premium_publication(professional_id); end loop;
  end if;
  return new;
end $$;
drop trigger if exists profile_status_premium_publication on public.profiles;
create trigger profile_status_premium_publication after update of status on public.profiles for each row execute function public.refresh_publication_after_account_status();
drop trigger if exists organization_status_premium_publication on public.organizations;
create trigger organization_status_premium_publication after update of status on public.organizations for each row execute function public.refresh_publication_after_account_status();

-- Reavalia perfis já contratados sem alterar histórico financeiro.
do $$ declare item record; begin for item in select professional_id from public.premium_contracts where professional_id is not null loop perform public.refresh_premium_publication(item.professional_id); end loop; end $$;
notify pgrst,'reload schema';
