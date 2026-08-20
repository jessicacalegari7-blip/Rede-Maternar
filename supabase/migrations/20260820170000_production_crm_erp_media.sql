-- Produção: persistência multi-tenant do CRM/ERP e mídias do Marketplace.
alter table public.professional_profiles
  add column if not exists office_video_urls text[] not null default '{}';

grant select on public.specialties to anon, authenticated;
grant select, insert, update, delete on public.professional_specialties to authenticated;
grant select, insert, update on public.professional_profiles to authenticated;
grant select on public.professional_profiles to anon;
grant select, insert, update on public.leads, public.patient_profiles, public.patient_records,
  public.services, public.financial_entries, public.cash_sessions to authenticated;

grant update (office_video_urls) on public.professional_profiles to authenticated;

-- Cadastro atômico e idempotente: evita pacientes órfãos e duplicidade por contato.
create or replace function public.upsert_crm_contact(
  p_organization_id uuid, p_name text, p_phone text, p_email text default null,
  p_cpf text default null, p_source text default 'Cadastro manual',
  p_status public.lead_status default 'new', p_notes text default null,
  p_service_interest text default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare v_patient_id uuid; v_user_id uuid := auth.uid(); v_notes text;
begin
  if v_user_id is null or not public.is_organization_member(p_organization_id) then raise exception 'Acesso negado à organização'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'Nome e telefone são obrigatórios'; end if;
  v_notes := concat_ws(E'\n', nullif(trim(p_notes),''), case when nullif(trim(p_service_interest),'') is not null then 'Serviço de interesse: '||trim(p_service_interest) end);
  select id into v_patient_id from public.patient_profiles where organization_id=p_organization_id
    and ((nullif(regexp_replace(phone,'\D','','g'),'')=nullif(regexp_replace(p_phone,'\D','','g'),'') and nullif(regexp_replace(p_phone,'\D','','g'),'') is not null)
      or (nullif(trim(p_email),'') is not null and lower(email)=lower(trim(p_email)))) limit 1;
  if v_patient_id is null then
    insert into public.patient_profiles(organization_id,full_name,phone,email,cpf,notes,created_by)
    values(p_organization_id,trim(p_name),trim(p_phone),nullif(trim(p_email),''),nullif(regexp_replace(p_cpf,'\D','','g'),''),nullif(v_notes,''),v_user_id) returning id into v_patient_id;
  else
    update public.patient_profiles set full_name=trim(p_name),phone=trim(p_phone),email=nullif(trim(p_email),''),cpf=coalesce(nullif(regexp_replace(p_cpf,'\D','','g'),''),cpf),notes=coalesce(nullif(v_notes,''),notes),updated_at=now() where id=v_patient_id;
  end if;
  insert into public.leads(organization_id,patient_id,full_name,phone,email,source,status,created_by)
  select p_organization_id,v_patient_id,trim(p_name),trim(p_phone),nullif(trim(p_email),''),p_source,p_status,v_user_id
  where not exists(select 1 from public.leads where organization_id=p_organization_id and patient_id=v_patient_id);
  return v_patient_id;
end $$;
grant execute on function public.upsert_crm_contact(uuid,text,text,text,text,text,public.lead_status,text,text) to authenticated;

drop policy if exists "financial entries organization manage" on public.financial_entries;
create policy "financial entries organization manage" on public.financial_entries for all to authenticated
using (public.is_organization_member(organization_id) or public.is_platform_admin())
with check (public.is_organization_member(organization_id) or public.is_platform_admin());

drop policy if exists "services organization manage" on public.services;
create policy "services organization manage" on public.services for all to authenticated
using (public.is_organization_member(organization_id) or public.is_platform_admin())
with check (public.is_organization_member(organization_id) or public.is_platform_admin());

drop policy if exists "patients organization manage" on public.patient_profiles;
create policy "patients organization manage" on public.patient_profiles for all to authenticated
using (public.is_organization_member(organization_id) or public.is_platform_admin())
with check (public.is_organization_member(organization_id) or public.is_platform_admin());

drop policy if exists "cash sessions organization manage" on public.cash_sessions;
create policy "cash sessions organization manage" on public.cash_sessions for all to authenticated
using (public.is_organization_member(organization_id) or public.is_platform_admin())
with check (public.is_organization_member(organization_id) or public.is_platform_admin());

-- Remove somente o conteúdo demonstrativo original; matérias reais são preservadas.
delete from public.news_articles where is_demo is true;

update storage.buckets set file_size_limit=83886080,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
where id='marketplace-media';
