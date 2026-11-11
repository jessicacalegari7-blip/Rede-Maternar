-- URLs publicas estaveis para perfis Premium. Nao altera cobrancas nem contratos.
alter table public.professional_profiles add column if not exists public_slug text;

create unique index if not exists professional_profiles_public_slug_uidx
  on public.professional_profiles(public_slug) where public_slug is not null;

create table if not exists public.professional_profile_slug_history (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  slug text not null unique,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists professional_profile_slug_history_professional_idx
  on public.professional_profile_slug_history(professional_id);
alter table public.professional_profile_slug_history enable row level security;
revoke all on public.professional_profile_slug_history from anon, authenticated, public;

create or replace function public.normalize_professional_public_slug(display_name text)
returns text language sql immutable strict set search_path='' as $$
  select trim(both from regexp_replace(
    translate(lower(display_name),
      'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
      'aaaaaaeeeeiiiiooooouuuucnyy'),
    '[^a-z0-9]+','','g'))
$$;

create or replace function public.professional_public_slug_reserved(candidate text)
returns boolean language sql immutable strict set search_path='' as $$
  select candidate = any(array[
    'admin','api','cadastro','cadastroprofissional','checkout','contato','convite',
    'convitepremium','cookies','definirsenha','diretorio','expediente','login','lgpd',
    'marketplace','noticias','paciente','paraprofissionais','perfil','privacidade',
    'profissional','profissionais','recuperarsenha','robots','sitemap','sobre',
    'termos','universidade','vagas','isencaoderesponsabilidade'
  ])
$$;

create or replace function public.ensure_professional_public_slug(target_professional_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  profile_name text;
  existing_slug text;
  base_slug text;
  candidate text;
  suffix text;
  counter integer:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_professional_id::text,0));
  select full_name,public_slug into profile_name,existing_slug
  from public.professional_profiles where id=target_professional_id for update;
  if existing_slug is not null then return existing_slug; end if;
  base_slug:=public.normalize_professional_public_slug(coalesce(profile_name,''));
  if length(base_slug)<3 then return null; end if;
  suffix:=substr(replace(target_professional_id::text,'-',''),1,6);
  candidate:=case when public.professional_public_slug_reserved(base_slug) then base_slug||suffix else base_slug end;
  while exists(select 1 from public.professional_profiles where public_slug=candidate)
     or exists(select 1 from public.professional_profile_slug_history where slug=candidate) loop
    counter:=counter+1;
    candidate:=base_slug||suffix||case when counter=1 then '' else counter::text end;
  end loop;
  update public.professional_profiles set public_slug=candidate where id=target_professional_id;
  insert into public.professional_profile_slug_history(professional_id,slug,is_current)
  values(target_professional_id,candidate,true) on conflict(slug) do nothing;
  return candidate;
end $$;

revoke all on function public.ensure_professional_public_slug(uuid) from public;
grant execute on function public.ensure_professional_public_slug(uuid) to service_role;

create or replace function public.assign_professional_public_slug()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.public_slug is null and coalesce(trim(new.full_name),'')<>'' then
    perform public.ensure_professional_public_slug(new.id);
  end if;
  return new;
end $$;

drop trigger if exists professional_profiles_assign_public_slug on public.professional_profiles;
create trigger professional_profiles_assign_public_slug
after insert or update of full_name on public.professional_profiles
for each row when (new.public_slug is null)
execute function public.assign_professional_public_slug();

do $$ declare profile_id uuid; begin
  for profile_id in select id from public.professional_profiles where public_slug is null and coalesce(trim(full_name),'')<>'' loop
    perform public.ensure_professional_public_slug(profile_id);
  end loop;
end $$;

alter table public.professional_profiles drop constraint if exists professional_profiles_public_slug_format;
alter table public.professional_profiles add constraint professional_profiles_public_slug_format
  check(public_slug is null or public_slug~'^[a-z0-9]{3,96}$');

create or replace view public.marketplace_professionals as
select pp.id,pp.full_name,pp.bio,pp.whatsapp,pp.email,pp.city,pp.state_code,pp.neighborhood,pp.clinic_name,pp.accepts_online,pp.verified,pp.rating,pp.review_count,pp.accepted_insurances,pp.payment_methods,o.plan::text as plan,
coalesce(array_agg(distinct s.name) filter(where s.id is not null),'{}') as specialties,pp.profile_image_url,pp.cover_image_url,pp.office_video_url,pp.gallery_urls,pp.clinic_description,pp.opening_hours,pp.website_url,pp.instagram_handle,pp.facebook_url,pp.tiktok_url,pp.office_video_urls,
coalesce((select array_agg(sc.city||', '||sc.state_code order by sc.is_primary desc,sc.city) from public.professional_service_cities sc where sc.professional_id=pp.id and sc.active),array[pp.city||', '||pp.state_code]) as visibility_cities,
pp.public_slug
from public.professional_profiles pp join public.organizations o on o.id=pp.organization_id left join public.professional_specialties ps on ps.professional_id=pp.id left join public.specialties s on s.id=ps.specialty_id and s.active where pp.marketplace_visible and o.status='active' group by pp.id,o.plan;
grant select on public.marketplace_professionals to anon,authenticated;

notify pgrst, 'reload schema';
