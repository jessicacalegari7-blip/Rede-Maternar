-- Estruturas incrementais. Aplicar somente quando o projeto Supabase voltar a aceitar operações.
create or replace function public.can_access_clinical_patient(target_organization_id uuid,target_patient_id uuid,target_action text default 'read')
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.patient_profiles p where p.id=target_patient_id and p.organization_id=target_organization_id)
  and exists (
    select 1 from public.organization_members m
    where m.organization_id=target_organization_id and m.user_id=auth.uid() and m.active
    and (m.role in ('owner','admin') or (m.role='professional' and exists (
      select 1 from public.professional_profiles pp
      where pp.organization_id=target_organization_id and pp.user_id=auth.uid()
      and (exists(select 1 from public.appointments a where a.organization_id=target_organization_id and a.patient_id=target_patient_id and a.professional_id=pp.id)
        or exists(select 1 from public.leads l where l.organization_id=target_organization_id and l.patient_id=target_patient_id and l.assigned_professional_id=pp.id))
    )))
  );
$$;
revoke all on function public.can_access_clinical_patient(uuid,uuid,text) from public;
grant execute on function public.can_access_clinical_patient(uuid,uuid,text) to authenticated;

create table public.patient_health_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  category text not null check(category in ('alimentação','hidratação','sono','atividade física','amamentação','medicação','suplementação','exercícios','fisioterapia','saúde mental','rotina','outros')),
  title text not null check(length(trim(title)) between 3 and 160),
  description text not null default '',
  frequency text not null default '',
  goal text not null default '',
  starts_on date not null default current_date,
  ends_on date,
  notes text not null default '',
  status text not null default 'ativo' check(status in ('ativo','concluído','pausado','cancelado')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_on is null or ends_on>=starts_on)
);
create index patient_health_plans_patient_idx on public.patient_health_plans(organization_id,patient_id,created_at desc);
create trigger patient_health_plans_updated_at before update on public.patient_health_plans for each row execute function public.set_updated_at();

create table public.patient_health_plan_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(id) on delete cascade,
  plan_id uuid not null references public.patient_health_plans(id) on delete cascade,
  observed_on date not null default current_date,
  value text not null check(length(trim(value)) between 1 and 300),
  notes text not null default '',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index patient_health_plan_entries_plan_idx on public.patient_health_plan_entries(plan_id,observed_on desc);

create or replace function public.validate_patient_health_link() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and tg_table_name='patient_health_plans' then
    if new.organization_id<>old.organization_id or new.patient_id<>old.patient_id or new.created_by<>old.created_by then
      raise exception 'Identidade do plano não pode ser alterada';
    end if;
  end if;
  if not exists(select 1 from public.patient_profiles p where p.id=new.patient_id and p.organization_id=new.organization_id) then
    raise exception 'Paciente não pertence à organização';
  end if;
  if tg_table_name='patient_health_plan_entries' then
    if not exists(select 1 from public.patient_health_plans h where h.id=new.plan_id and h.organization_id=new.organization_id and h.patient_id=new.patient_id) then
      raise exception 'Plano não pertence ao paciente';
    end if;
  end if;
  if tg_table_name='patient_health_plans' then
    if new.professional_id is not null and not exists(select 1 from public.professional_profiles pp where pp.id=new.professional_id and pp.organization_id=new.organization_id) then
      raise exception 'Profissional não pertence à organização';
    end if;
  end if;
  return new;
end $$;
create trigger patient_health_plans_validate before insert or update on public.patient_health_plans for each row execute function public.validate_patient_health_link();
create trigger patient_health_plan_entries_validate before insert or update on public.patient_health_plan_entries for each row execute function public.validate_patient_health_link();

create or replace function public.audit_patient_health_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(new.organization_id,auth.uid(),case when tg_op='INSERT' then 'clinical_create' else 'clinical_update' end,tg_table_name,new.id,
    jsonb_build_object('patient_id',new.patient_id));
  return new;
end $$;
create trigger patient_health_plans_audit after insert or update on public.patient_health_plans for each row execute function public.audit_patient_health_change();
create trigger patient_health_plan_entries_audit after insert on public.patient_health_plan_entries for each row execute function public.audit_patient_health_change();

alter table public.patient_health_plans enable row level security;
alter table public.patient_health_plan_entries enable row level security;
create policy "health plans clinical read" on public.patient_health_plans for select to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'read'));
create policy "health plans clinical insert" on public.patient_health_plans for insert to authenticated
  with check(created_by=auth.uid() and public.can_access_clinical_patient(organization_id,patient_id,'write'));
create policy "health plans clinical update" on public.patient_health_plans for update to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'write'))
  with check(public.can_access_clinical_patient(organization_id,patient_id,'write'));
create policy "health entries clinical read" on public.patient_health_plan_entries for select to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'read'));
create policy "health entries clinical insert" on public.patient_health_plan_entries for insert to authenticated
  with check(created_by=auth.uid() and public.can_access_clinical_patient(organization_id,patient_id,'write'));
grant select,insert,update on public.patient_health_plans to authenticated;
grant select,insert on public.patient_health_plan_entries to authenticated;

-- Restringe o prontuário existente sem alterar seus dados.
drop policy if exists "patient records organization manage" on public.patient_records;
create policy "patient records clinical read" on public.patient_records for select to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'read'));
create policy "patient records clinical insert" on public.patient_records for insert to authenticated
  with check(author_id=auth.uid() and public.can_access_clinical_patient(organization_id,patient_id,'write'));
create policy "patient records clinical update" on public.patient_records for update to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'write'))
  with check(public.can_access_clinical_patient(organization_id,patient_id,'write'));

drop policy if exists "patient documents organization read" on public.patient_documents;
drop policy if exists "patient documents organization write" on public.patient_documents;
create policy "patient documents clinical read" on public.patient_documents for select to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'read'));
create policy "patient documents clinical insert" on public.patient_documents for insert to authenticated
  with check(created_by=auth.uid() and public.can_access_clinical_patient(organization_id,patient_id,'write'));
create policy "patient documents clinical update" on public.patient_documents for update to authenticated
  using(public.can_access_clinical_patient(organization_id,patient_id,'write'))
  with check(public.can_access_clinical_patient(organization_id,patient_id,'write'));

drop policy if exists "clinical attachments organization read" on storage.objects;
drop policy if exists "clinical attachments organization insert" on storage.objects;
drop policy if exists "clinical attachments organization delete" on storage.objects;
create policy "clinical attachments patient read" on storage.objects for select to authenticated
  using(bucket_id='clinical-attachments' and public.can_access_clinical_patient(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid,'read'));
create policy "clinical attachments patient insert" on storage.objects for insert to authenticated
  with check(bucket_id='clinical-attachments' and (storage.foldername(name))[3]=auth.uid()::text and public.can_access_clinical_patient(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid,'write'));
create policy "clinical attachments patient delete" on storage.objects for delete to authenticated
  using(bucket_id='clinical-attachments' and public.can_access_clinical_patient(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid,'write'));
