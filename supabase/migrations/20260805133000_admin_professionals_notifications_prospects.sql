-- Backoffice real, fila de notificações e base privada de prospecção.
create table if not exists public.admin_email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.admin_email_notifications enable row level security;
create policy "admin notifications platform admin read" on public.admin_email_notifications
  for select to authenticated using (public.is_platform_admin());

create or replace function public.queue_professional_signup_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  signup_email text;
  organization_name text;
  selected_plan text;
begin
  select u.email into signup_email from auth.users u where u.id = new.user_id;
  select o.display_name, o.plan::text into organization_name, selected_plan
    from public.organizations o where o.id = new.organization_id;
  insert into public.admin_email_notifications (event_type, recipient, subject, payload)
  values (
    'professional_signup',
    'jessica.calegari7@gmail.com',
    'Novo cadastro profissional na Rede Maternar',
    jsonb_build_object(
      'user_id', new.user_id, 'professional_profile_id', new.id,
      'organization_id', new.organization_id, 'full_name', new.full_name,
      'email', signup_email, 'whatsapp', new.whatsapp, 'city', new.city,
      'state_code', new.state_code, 'organization_name', organization_name,
      'plan', selected_plan, 'created_at', new.created_at
    )
  );
  return new;
end;
$$;
drop trigger if exists professional_signup_queue_admin_email on public.professional_profiles;
create trigger professional_signup_queue_admin_email
  after insert on public.professional_profiles for each row
  execute function public.queue_professional_signup_notification();

create or replace function public.admin_list_professionals()
returns table (
  user_id uuid, professional_profile_id uuid, organization_id uuid,
  full_name text, email text, phone text, specialty text, city text,
  state_code text, organization_name text, organization_type text,
  plan text, status text, marketplace_visible boolean, verified boolean,
  created_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  return query
  select p.id, pp.id, o.id, pp.full_name, u.email::text,
    coalesce(pp.whatsapp, p.phone), specialty.name, pp.city, pp.state_code::text,
    o.display_name, o.type::text, o.plan::text, p.status::text,
    pp.marketplace_visible, pp.verified, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  join public.organization_members om on om.user_id = p.id and om.active
  join public.organizations o on o.id = om.organization_id
  join public.professional_profiles pp on pp.organization_id = o.id and pp.user_id = p.id
  left join lateral (
    select s.name from public.professional_specialties ps
    join public.specialties s on s.id = ps.specialty_id
    where ps.professional_id = pp.id order by ps.is_primary desc, s.name limit 1
  ) specialty on true
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_set_professional_status(
  target_user_id uuid, new_status public.account_status
)
returns void language plpgsql security definer set search_path = '' as $$
declare target_organization_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Acesso administrativo necessário'; end if;
  select om.organization_id into target_organization_id
    from public.organization_members om
    where om.user_id = target_user_id and om.active order by om.created_at limit 1;
  update public.profiles set status = new_status, updated_at = now() where id = target_user_id;
  if target_organization_id is not null then
    update public.organizations set status = new_status, updated_at = now()
      where id = target_organization_id;
    update public.professional_profiles
      set marketplace_visible = (new_status = 'active'), updated_at = now()
      where organization_id = target_organization_id;
  end if;
  insert into public.audit_logs (actor_id, organization_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), target_organization_id, 'professional_status_changed', 'profile',
    target_user_id, jsonb_build_object('new_status', new_status));
end;
$$;
revoke all on function public.admin_list_professionals() from public;
revoke all on function public.admin_set_professional_status(uuid, public.account_status) from public;
grant execute on function public.admin_list_professionals() to authenticated;
grant execute on function public.admin_set_professional_status(uuid, public.account_status) to authenticated;

create table if not exists public.clinic_prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_specialty text not null,
  city text not null,
  state_code char(2) not null,
  whatsapp text,
  source_url text not null unique,
  source_name text,
  source_checked_at timestamptz not null default now(),
  canonical_key text generated always as (
    lower(regexp_replace(name || '|' || city || '|' || state_code, '[^a-zA-Z0-9]+', '', 'g'))
  ) stored unique,
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','rejected','duplicate')),
  publication_status text not null default 'unpublished'
    check (publication_status in ('unpublished','published','claimed','removed')),
  outreach_status text not null default 'not_contacted'
    check (outreach_status in ('not_contacted','consent_requested','opted_in','opted_out','contacted')),
  legal_basis_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clinic_prospects_review_idx
  on public.clinic_prospects (review_status, publication_status, state_code, city);
alter table public.clinic_prospects enable row level security;
revoke all on public.clinic_prospects from anon, authenticated;
grant select, insert, update, delete on public.clinic_prospects to authenticated;
create policy "clinic prospects admin manage" on public.clinic_prospects
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create or replace view public.published_clinic_directory as
  select id, name, primary_specialty, city, state_code
  from public.clinic_prospects
  where review_status = 'approved' and publication_status = 'published';
grant select on public.published_clinic_directory to anon, authenticated;
