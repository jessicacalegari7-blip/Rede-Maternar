-- Cadastro real: especialidades por plano, cidades de divulgação e mídia de perfil.
insert into public.specialties(name,slug,active) values
  ('Pediatria','pediatria',true),
  ('Sono Infantil','sono-infantil',true),
  ('Psicopedagogia','psicopedagogia',true),
  ('Orientação Parental','orientacao-parental',true)
on conflict(slug) do update set name=excluded.name,active=true;

do $$
declare canonical_id uuid; duplicate_id uuid; alias_name text;
begin
  for alias_name in select unnest(array['Pediatra','Especialista em Sono Infantil','Educadora Parental','Orientadora Parental','Psicopedagoga']) loop
    select id into canonical_id from public.specialties where slug=case alias_name
      when 'Pediatra' then 'pediatria' when 'Especialista em Sono Infantil' then 'sono-infantil'
      when 'Psicopedagoga' then 'psicopedagogia' else 'orientacao-parental' end;
    select id into duplicate_id from public.specialties where lower(name)=lower(alias_name) and id<>canonical_id limit 1;
    if duplicate_id is not null then
      insert into public.professional_specialties(professional_id,specialty_id,is_primary)
      select professional_id,canonical_id,is_primary from public.professional_specialties where specialty_id=duplicate_id
      on conflict(professional_id,specialty_id) do update set is_primary=public.professional_specialties.is_primary or excluded.is_primary;
      delete from public.professional_specialties where specialty_id=duplicate_id;
      update public.specialties set active=false where id=duplicate_id;
    end if;
    duplicate_id:=null;
  end loop;
end $$;

create table if not exists public.professional_service_cities(
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  city text not null,state_code char(2) not null,is_primary boolean not null default false,
  active boolean not null default true,created_at timestamptz not null default now(),
  unique(professional_id,city,state_code)
);
alter table public.professional_service_cities enable row level security;
create policy "service cities public read" on public.professional_service_cities for select to anon,authenticated using(active or exists(select 1 from public.professional_profiles p where p.id=professional_id and (public.is_organization_member(p.organization_id) or public.is_platform_admin())));
create policy "service cities owner manage" on public.professional_service_cities for all to authenticated using(exists(select 1 from public.professional_profiles p where p.id=professional_id and (public.is_organization_member(p.organization_id) or public.is_platform_admin()))) with check(exists(select 1 from public.professional_profiles p where p.id=professional_id and (public.is_organization_member(p.organization_id) or public.is_platform_admin())));
grant select on public.professional_service_cities to anon,authenticated;
grant insert,update,delete on public.professional_service_cities to authenticated;
insert into public.professional_service_cities(professional_id,city,state_code,is_primary)
select id,city,state_code,true from public.professional_profiles on conflict do nothing;

create or replace function public.enforce_professional_specialty_limit() returns trigger language plpgsql security definer set search_path='' as $$
declare selected_plan public.plan_code; max_specialties integer;
begin
  select o.plan into selected_plan from public.professional_profiles pp join public.organizations o on o.id=pp.organization_id where pp.id=new.professional_id;
  max_specialties:=case when selected_plan='clinic' then null when selected_plan='independent' then 3 else 1 end;
  if max_specialties is not null and (select count(*) from public.professional_specialties where professional_id=new.professional_id)>=max_specialties then raise exception 'Este plano permite no máximo % especialidade(s)',max_specialties;end if;
  return new;
end $$;

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare v_organization_id uuid;v_professional_id uuid;v_specialty_id uuid;selected_plan public.plan_code;selected_type public.organization_type;specialty_name text;city_label text;city_parts text[];position integer:=0;max_specialties integer;
begin
  insert into public.profiles(id,full_name,phone) values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),nullif(trim(new.raw_user_meta_data->>'phone'),''));
  if new.raw_user_meta_data->>'account_type'='professional' then
    selected_plan:=case when new.raw_user_meta_data->>'plan' in('free','marketplace','independent','clinic') then (new.raw_user_meta_data->>'plan')::public.plan_code else 'free'::public.plan_code end;
    selected_type:=case when selected_plan='clinic' then 'clinic'::public.organization_type else 'independent'::public.organization_type end;
    max_specialties:=case when selected_plan='clinic' then 1000 when selected_plan='independent' then 3 else 1 end;
    insert into public.organizations(type,display_name,plan,status,created_by) values(selected_type,coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'),''),trim(new.raw_user_meta_data->>'full_name')),selected_plan,'pending',new.id) returning id into v_organization_id;
    insert into public.organization_members(organization_id,user_id,role) values(v_organization_id,new.id,'owner');
    insert into public.professional_profiles(organization_id,user_id,full_name,professional_registration,whatsapp,city,state_code,clinic_name,marketplace_visible)
    values(v_organization_id,new.id,trim(new.raw_user_meta_data->>'full_name'),nullif(trim(new.raw_user_meta_data->>'professional_registration'),''),nullif(trim(new.raw_user_meta_data->>'phone'),''),coalesce(nullif(trim(new.raw_user_meta_data->>'city'),''),'Não informada'),coalesce(nullif(upper(trim(new.raw_user_meta_data->>'state_code')),''),'SP'),case when selected_type='clinic' then coalesce(nullif(trim(new.raw_user_meta_data->>'organization_name'),''),trim(new.raw_user_meta_data->>'full_name')) end,false) returning id into v_professional_id;
    for specialty_name in select value from jsonb_array_elements_text(case when jsonb_typeof(new.raw_user_meta_data->'specialties')='array' then new.raw_user_meta_data->'specialties' else jsonb_build_array(new.raw_user_meta_data->>'specialty') end) limit max_specialties loop
      select id into v_specialty_id from public.specialties where active and lower(name)=lower(specialty_name) limit 1;
      if v_specialty_id is not null then position:=position+1;insert into public.professional_specialties values(v_professional_id,v_specialty_id,position=1,now()) on conflict do nothing;end if;
    end loop;
    for city_label in select value from jsonb_array_elements_text(case when jsonb_typeof(new.raw_user_meta_data->'visibility_cities')='array' then new.raw_user_meta_data->'visibility_cities' else jsonb_build_array(concat(new.raw_user_meta_data->>'city',', ',new.raw_user_meta_data->>'state_code')) end) loop
      city_parts:=regexp_split_to_array(city_label,'\s*,\s*');
      if array_length(city_parts,1)>=2 then insert into public.professional_service_cities(professional_id,city,state_code,is_primary) values(v_professional_id,array_to_string(city_parts[1:array_length(city_parts,1)-1],', '),upper(city_parts[array_length(city_parts,1)])::char(2),not exists(select 1 from public.professional_service_cities sc where sc.professional_id=v_professional_id)) on conflict do nothing;end if;
    end loop;
  end if;return new;
end $$;

create or replace view public.marketplace_professionals as
select pp.id,pp.full_name,pp.bio,pp.whatsapp,pp.email,pp.city,pp.state_code,pp.neighborhood,pp.clinic_name,pp.accepts_online,pp.verified,pp.rating,pp.review_count,pp.accepted_insurances,pp.payment_methods,o.plan::text as plan,
coalesce(array_agg(distinct s.name) filter(where s.id is not null),'{}') as specialties,pp.profile_image_url,pp.cover_image_url,pp.office_video_url,pp.gallery_urls,pp.clinic_description,pp.opening_hours,pp.website_url,pp.instagram_handle,pp.facebook_url,pp.tiktok_url,pp.office_video_urls,
coalesce((select array_agg(sc.city||', '||sc.state_code order by sc.is_primary desc,sc.city) from public.professional_service_cities sc where sc.professional_id=pp.id and sc.active),array[pp.city||', '||pp.state_code]) as visibility_cities
from public.professional_profiles pp join public.organizations o on o.id=pp.organization_id left join public.professional_specialties ps on ps.professional_id=pp.id left join public.specialties s on s.id=ps.specialty_id and s.active where pp.marketplace_visible and o.status='active' group by pp.id,o.plan;
grant select on public.marketplace_professionals to anon,authenticated;

-- Repara os cadastros já aprovados que ficaram sem confirmação de e-mail.
update auth.users u set email_confirmed_at=coalesce(u.email_confirmed_at,now()),updated_at=now()
where u.email_confirmed_at is null and exists(select 1 from public.profiles p where p.id=u.id and p.status='active');

update storage.buckets set public=true,file_size_limit=83886080,allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'] where id='marketplace-media';
create policy "marketplace media owner update" on storage.objects for update to authenticated using(bucket_id='marketplace-media' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='marketplace-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "marketplace media owner delete" on storage.objects for delete to authenticated using(bucket_id='marketplace-media' and (storage.foldername(name))[1]=auth.uid()::text);
