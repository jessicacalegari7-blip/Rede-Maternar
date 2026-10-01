-- Keep professional approval atomic and independent from the Vercel service-role route.
create or replace function public.admin_set_professional_status(
  target_user_id uuid,
  new_status public.account_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  target_email text;
  target_name text;
  affected_rows integer;
  email_queued boolean := false;
begin
  if not public.is_platform_admin() then
    raise exception 'Acesso administrativo necessário';
  end if;

  select om.organization_id
    into target_organization_id
    from public.organization_members om
    where om.user_id = target_user_id and om.active
    order by om.created_at
    limit 1;

  if target_organization_id is null then
    raise exception 'Organização ativa do profissional não encontrada';
  end if;

  update public.profiles
    set status = new_status, updated_at = now()
    where id = target_user_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Perfil do profissional não encontrado';
  end if;

  update public.organizations
    set status = new_status, updated_at = now()
    where id = target_organization_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Cadastro da organização não encontrado';
  end if;

  update public.professional_profiles
    set marketplace_visible = (new_status = 'active'), updated_at = now()
    where organization_id = target_organization_id
      and user_id = target_user_id;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Perfil público do profissional não encontrado';
  end if;

  select u.email::text, coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name', '')
    into target_email, target_name
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = target_user_id;

  if new_status = 'active' and target_email is not null and not exists (
    select 1
      from public.admin_email_notifications n
      where n.event_type = 'professional_approved'
        and n.recipient = target_email
        and n.payload ->> 'user_id' = target_user_id::text
        and n.status in ('pending', 'processing', 'sent')
  ) then
    insert into public.admin_email_notifications(event_type, recipient, subject, payload)
    values (
      'professional_approved',
      target_email,
      'Cadastro aprovado na MaterPlace',
      jsonb_build_object('user_id', target_user_id, 'full_name', target_name)
    );
    email_queued := true;
  end if;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), target_organization_id, 'professional_status_changed', 'profile',
    target_user_id, jsonb_build_object('new_status', new_status)
  );

  return;
end;
$$;

revoke all on function public.admin_set_professional_status(uuid, public.account_status) from public;
grant execute on function public.admin_set_professional_status(uuid, public.account_status) to authenticated;
