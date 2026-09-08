-- Fundação definitiva e incremental do CRM + ERP MaterPlace.
-- Preserva os dados existentes e mantém as colunas legadas durante a transição.

create table if not exists public.organization_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  postal_code text, address_line text, address_number text, address_complement text,
  neighborhood text, city text, state_code char(2),
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Atendimento',
  is_default boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_pipeline_default_org_unique on public.crm_pipelines(organization_id) where is_default and active;

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  color text not null default '#56745F' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null check (position >= 0),
  legacy_status public.lead_status,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, position)
);

alter table public.patient_profiles
  add column if not exists social_name text,
  add column if not exists rg text,
  add column if not exists gender text,
  add column if not exists whatsapp text,
  add column if not exists postal_code text,
  add column if not exists address_line text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state_code char(2),
  add column if not exists archived_at timestamptz;

alter table public.leads
  add column if not exists pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  add column if not exists stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  add column if not exists position numeric(20,8) not null default 0,
  add column if not exists assigned_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists unit_id uuid references public.organization_units(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists interest text,
  add column if not exists next_action text,
  add column if not exists first_contact_at timestamptz,
  add column if not exists last_interaction_at timestamptz,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz;

create table if not exists public.crm_lead_stage_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  to_stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  from_position numeric(20,8),
  to_position numeric(20,8) not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.crm_interactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid references public.patient_profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('note','call','email','whatsapp','meeting','system')),
  summary text not null check (char_length(trim(summary)) > 0),
  occurred_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (patient_id is not null or lead_id is not null)
);

create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null default '#56745F' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create table if not exists public.patient_tags (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(id) on delete cascade,
  tag_id uuid not null references public.crm_tags(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (patient_id, tag_id)
);

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('revenue','direct_cost','operating_expense','personnel','marketing','administrative','infrastructure','tax','financial_fee')),
  parent_id uuid references public.financial_categories(id) on delete set null,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name, kind)
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  method_type text not null check (method_type in ('cash','pix','debit_card','credit_card','boleto','bank_transfer','insurance','other')),
  percentage_fee numeric(7,4) not null default 0 check (percentage_fee >= 0),
  fixed_fee_cents integer not null default 0 check (fixed_fee_cents >= 0),
  settlement_days integer not null default 0 check (settlement_days >= 0),
  max_installments integer not null default 1 check (max_installments >= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  center_type text not null check (center_type in ('unit','department','professional','administrative','marketing','project')),
  unit_id uuid references public.organization_units(id) on delete set null,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  account_type text not null check (account_type in ('cash','bank','wallet','gateway')),
  opening_balance_cents bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.financial_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  frequency text not null check (frequency in ('weekly','monthly','annual','custom')),
  interval_count integer not null default 1 check (interval_count > 0),
  starts_on date not null,
  ends_on date,
  next_run_on date,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

alter table public.financial_entries
  add column if not exists professional_id uuid references public.professional_profiles(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists unit_id uuid references public.organization_units(id) on delete set null,
  add column if not exists category_id uuid references public.financial_categories(id) on delete set null,
  add column if not exists cost_center_id uuid references public.cost_centers(id) on delete set null,
  add column if not exists cash_account_id uuid references public.cash_accounts(id) on delete set null,
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null,
  add column if not exists recurrence_rule_id uuid references public.financial_recurrence_rules(id) on delete set null,
  add column if not exists competence_date date,
  add column if not exists issued_at timestamptz not null default now(),
  add column if not exists gross_amount_cents bigint not null default 0,
  add column if not exists discount_cents bigint not null default 0,
  add column if not exists surcharge_cents bigint not null default 0,
  add column if not exists received_amount_cents bigint not null default 0,
  add column if not exists financial_fee_cents bigint not null default 0,
  add column if not exists net_received_cents bigint not null default 0,
  add column if not exists installments integer not null default 1,
  add column if not exists document_number text,
  add column if not exists notes text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz;

update public.financial_entries set
  gross_amount_cents=amount_cents,
  competence_date=coalesce(competence_date,due_date,created_at::date),
  received_amount_cents=case when status='paid' then amount_cents else received_amount_cents end,
  net_received_cents=case when status='paid' then amount_cents else net_received_cents end
where gross_amount_cents=0 or competence_date is null;

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  financial_entry_id uuid not null references public.financial_entries(id) on delete restrict,
  cash_account_id uuid references public.cash_accounts(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  transaction_type text not null check (transaction_type in ('receipt','payment','refund','reversal','adjustment')),
  amount_cents bigint not null check (amount_cents > 0),
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  net_amount_cents bigint not null,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create table if not exists public.professional_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete restrict,
  patient_id uuid references public.patient_profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  financial_entry_id uuid references public.financial_entries(id) on delete set null,
  rule_type text not null check (rule_type in ('percentage','fixed','per_procedure','custom')),
  gross_amount_cents bigint not null check (gross_amount_cents >= 0),
  calculation_base_cents bigint not null check (calculation_base_cents >= 0),
  percentage numeric(7,4),
  payout_amount_cents bigint not null check (payout_amount_cents >= 0),
  status text not null default 'forecast' check (status in ('forecast','pending_release','released','paid','cancelled')),
  due_date date,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, appointment_id, professional_id)
);

create table if not exists public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  scheduled_for timestamptz,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists unit_id uuid references public.organization_units(id) on delete set null,
  add column if not exists procedure_name text,
  add column if not exists administrative_notes text,
  add column if not exists attended_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists rescheduled_from_id uuid references public.appointments(id) on delete set null;

create index if not exists patient_profiles_org_phone_idx on public.patient_profiles(organization_id, phone);
create index if not exists patient_profiles_org_email_idx on public.patient_profiles(organization_id, lower(email));
create index if not exists patient_profiles_org_whatsapp_idx on public.patient_profiles(organization_id, whatsapp);
create index if not exists leads_org_stage_position_idx on public.leads(organization_id, stage_id, position) where archived_at is null;
create index if not exists leads_org_next_contact_idx on public.leads(organization_id, next_contact_at) where archived_at is null;
create index if not exists crm_history_lead_date_idx on public.crm_lead_stage_history(lead_id, changed_at desc);
create index if not exists crm_interactions_patient_date_idx on public.crm_interactions(patient_id, occurred_at desc);
create index if not exists appointments_org_status_start_idx on public.appointments(organization_id, status, starts_at);
create index if not exists financial_entries_org_due_idx on public.financial_entries(organization_id, due_date, status);
create index if not exists financial_entries_org_competence_idx on public.financial_entries(organization_id, competence_date, type);
create index if not exists financial_transactions_org_date_idx on public.financial_transactions(organization_id, occurred_at desc);
create index if not exists payouts_org_status_due_idx on public.professional_payouts(organization_id, status, due_date);
create index if not exists notifications_user_unread_idx on public.internal_notifications(user_id, created_at desc) where read_at is null and dismissed_at is null;

-- Cria o pipeline padrão para cada organização existente.
insert into public.crm_pipelines(organization_id,name,is_default,active,created_by)
select o.id,'Atendimento',true,true,o.created_by from public.organizations o
where not exists(select 1 from public.crm_pipelines p where p.organization_id=o.id and p.is_default and p.active);

insert into public.crm_pipeline_stages(organization_id,pipeline_id,name,color,position,legacy_status,is_won,is_lost)
select p.organization_id,p.id,v.name,v.color,v.position,v.legacy_status::public.lead_status,v.is_won,v.is_lost
from public.crm_pipelines p
cross join (values
 ('Novo contato','#6B7280',0,'new',false,false),
 ('Respondido','#3B82F6',1,'first_contact_attempt',false,false),
 ('2ª tentativa de contato','#D4AF37',2,'second_contact_attempt',false,false),
 ('3ª tentativa de contato','#F59E0B',3,'second_contact_attempt',false,false),
 ('Aguardando retorno','#8B5CF6',4,'future_contact',false,false),
 ('Em atendimento','#0EA5E9',5,'future_contact',false,false),
 ('Agendado','#059669',6,'scheduled',false,false),
 ('Compareceu','#16A34A',7,'completed',false,false),
 ('Não compareceu','#DC2626',8,'lost',false,true),
 ('Em acompanhamento','#14B8A6',9,'future_contact',false,false),
 ('Convertido','#15803D',10,'completed',true,false),
 ('Encerrado','#475569',11,'lost',false,true)
) as v(name,color,position,legacy_status,is_won,is_lost)
where p.is_default and p.active
and not exists(select 1 from public.crm_pipeline_stages s where s.pipeline_id=p.id and s.position=v.position);

update public.leads l set pipeline_id=p.id,stage_id=s.id,position=extract(epoch from l.created_at)
from public.crm_pipelines p, public.crm_pipeline_stages s
where p.organization_id=l.organization_id and p.is_default and p.active
and s.pipeline_id=p.id and s.legacy_status=l.status
and s.position=(select min(s2.position) from public.crm_pipeline_stages s2 where s2.pipeline_id=p.id and s2.legacy_status=l.status)
and (l.pipeline_id is null or l.stage_id is null);

create or replace function public.crm_default_pipeline_for_new_organization() returns trigger
language plpgsql security definer set search_path='' as $$
declare pipeline uuid;
begin
  insert into public.crm_pipelines(organization_id,name,is_default,active,created_by)
  values(new.id,'Atendimento',true,true,new.created_by) returning id into pipeline;
  insert into public.crm_pipeline_stages(organization_id,pipeline_id,name,color,position,legacy_status,is_won,is_lost) values
   (new.id,pipeline,'Novo contato','#6B7280',0,'new',false,false),
   (new.id,pipeline,'Respondido','#3B82F6',1,'first_contact_attempt',false,false),
   (new.id,pipeline,'2ª tentativa de contato','#D4AF37',2,'second_contact_attempt',false,false),
   (new.id,pipeline,'3ª tentativa de contato','#F59E0B',3,'second_contact_attempt',false,false),
   (new.id,pipeline,'Aguardando retorno','#8B5CF6',4,'future_contact',false,false),
   (new.id,pipeline,'Em atendimento','#0EA5E9',5,'future_contact',false,false),
   (new.id,pipeline,'Agendado','#059669',6,'scheduled',false,false),
   (new.id,pipeline,'Compareceu','#16A34A',7,'completed',false,false),
   (new.id,pipeline,'Não compareceu','#DC2626',8,'lost',false,true),
   (new.id,pipeline,'Em acompanhamento','#14B8A6',9,'future_contact',false,false),
   (new.id,pipeline,'Convertido','#15803D',10,'completed',true,false),
   (new.id,pipeline,'Encerrado','#475569',11,'lost',false,true);
  return new;
end $$;
drop trigger if exists organization_create_crm_pipeline on public.organizations;
create trigger organization_create_crm_pipeline after insert on public.organizations for each row execute function public.crm_default_pipeline_for_new_organization();

create or replace function public.organization_role(target_organization_id uuid) returns public.member_role
language sql stable security definer set search_path='' as $$
  select case when public.is_platform_admin() then 'owner'::public.member_role else (
    select om.role from public.organization_members om where om.organization_id=target_organization_id and om.user_id=auth.uid() and om.active limit 1
  ) end;
$$;

create or replace function public.can_access_organization_module(target_organization_id uuid,target_module text,target_action text default 'read') returns boolean
language sql stable security definer set search_path='' as $$
  select case public.organization_role(target_organization_id)
    when 'owner' then true
    when 'admin' then true
    when 'receptionist' then target_module in ('crm','agenda')
    when 'financial' then target_module in ('finance','reports')
    when 'professional' then target_module in ('agenda','crm') and target_action='read'
    else false end;
$$;
grant execute on function public.organization_role(uuid) to authenticated;
grant execute on function public.can_access_organization_module(uuid,text,text) to authenticated;

create or replace function public.move_crm_lead(target_lead_id uuid,target_stage_id uuid,target_position numeric default null)
returns void language plpgsql security definer set search_path='' as $$
declare current_lead public.leads; destination public.crm_pipeline_stages; actor uuid:=auth.uid(); next_position numeric; legacy public.lead_status;
begin
  select * into current_lead from public.leads where id=target_lead_id for update;
  if current_lead.id is null then raise exception 'Lead não encontrado'; end if;
  if not public.can_access_organization_module(current_lead.organization_id,'crm','write') then raise exception 'Acesso negado ao CRM'; end if;
  select * into destination from public.crm_pipeline_stages where id=target_stage_id and organization_id=current_lead.organization_id and active and archived_at is null;
  if destination.id is null then raise exception 'Etapa inválida'; end if;
  next_position:=coalesce(target_position,(select coalesce(max(position),0)+1024 from public.leads where organization_id=current_lead.organization_id and stage_id=target_stage_id and archived_at is null));
  legacy:=coalesce(destination.legacy_status,current_lead.status);
  update public.leads set pipeline_id=destination.pipeline_id,stage_id=destination.id,position=next_position,status=legacy,updated_at=now() where id=current_lead.id;
  insert into public.crm_lead_stage_history(organization_id,lead_id,from_stage_id,to_stage_id,from_position,to_position,changed_by)
  values(current_lead.organization_id,current_lead.id,current_lead.stage_id,destination.id,current_lead.position,next_position,actor);
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(current_lead.organization_id,actor,'crm_lead_moved','lead',current_lead.id,jsonb_build_object('from_stage_id',current_lead.stage_id,'to_stage_id',destination.id,'from_position',current_lead.position,'to_position',next_position));
end $$;
grant execute on function public.move_crm_lead(uuid,uuid,numeric) to authenticated;

create or replace function public.crm_assign_default_stage() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.pipeline_id is null then
    select p.id into new.pipeline_id from public.crm_pipelines p where p.organization_id=new.organization_id and p.is_default and p.active limit 1;
  end if;
  if new.stage_id is null then
    select s.id into new.stage_id from public.crm_pipeline_stages s
    where s.pipeline_id=new.pipeline_id and s.active and s.archived_at is null
    order by case when s.legacy_status=new.status then 0 else 1 end,s.position limit 1;
  end if;
  if new.position=0 then
    select coalesce(max(l.position),0)+1024 into new.position from public.leads l
    where l.organization_id=new.organization_id and l.stage_id=new.stage_id and l.archived_at is null;
  end if;
  return new;
end $$;
drop trigger if exists leads_assign_default_stage on public.leads;
create trigger leads_assign_default_stage before insert on public.leads for each row execute function public.crm_assign_default_stage();

create or replace function public.search_crm_patients(search_text text default '',page_offset integer default 0,page_limit integer default 50)
returns table(id uuid,full_name text,social_name text,email text,phone text,whatsapp text,cpf text,birth_date date,city text,state_code char(2),notes text,appointment_count integer,no_show_count integer,created_at timestamptz,total_count bigint)
language sql stable security invoker set search_path='' as $$
  select p.id,p.full_name,p.social_name,p.email,p.phone,p.whatsapp,p.cpf,p.birth_date,p.city,p.state_code,p.notes,p.appointment_count,p.no_show_count,p.created_at,count(*) over()
  from public.patient_profiles p
  where p.archived_at is null and public.can_access_organization_module(p.organization_id,'crm','read')
    and (nullif(trim(search_text),'') is null
      or p.full_name ilike '%'||trim(search_text)||'%'
      or coalesce(p.social_name,'') ilike '%'||trim(search_text)||'%'
      or regexp_replace(coalesce(p.cpf,''),'\D','','g') like '%'||regexp_replace(search_text,'\D','','g')||'%'
      or regexp_replace(coalesce(p.phone,''),'\D','','g') like '%'||regexp_replace(search_text,'\D','','g')||'%'
      or regexp_replace(coalesce(p.whatsapp,''),'\D','','g') like '%'||regexp_replace(search_text,'\D','','g')||'%'
      or coalesce(p.email,'') ilike '%'||trim(search_text)||'%')
  order by p.full_name limit least(greatest(page_limit,1),100) offset greatest(page_offset,0);
$$;
grant execute on function public.search_crm_patients(text,integer,integer) to authenticated;

create or replace function public.find_duplicate_crm_contacts(contact_cpf text default null,contact_phone text default null,contact_whatsapp text default null,contact_email text default null)
returns table(id uuid,full_name text,email text,phone text,whatsapp text,cpf text)
language sql stable security invoker set search_path='' as $$
  select p.id,p.full_name,p.email,p.phone,p.whatsapp,p.cpf from public.patient_profiles p
  where p.archived_at is null and public.can_access_organization_module(p.organization_id,'crm','read') and (
    (nullif(regexp_replace(contact_cpf,'\D','','g'),'') is not null and regexp_replace(coalesce(p.cpf,''),'\D','','g')=regexp_replace(contact_cpf,'\D','','g')) or
    (nullif(regexp_replace(contact_phone,'\D','','g'),'') is not null and regexp_replace(coalesce(p.phone,''),'\D','','g')=regexp_replace(contact_phone,'\D','','g')) or
    (nullif(regexp_replace(contact_whatsapp,'\D','','g'),'') is not null and regexp_replace(coalesce(p.whatsapp,''),'\D','','g')=regexp_replace(contact_whatsapp,'\D','','g')) or
    (nullif(trim(contact_email),'') is not null and lower(coalesce(p.email,''))=lower(trim(contact_email)))
  ) order by p.updated_at desc limit 10;
$$;
grant execute on function public.find_duplicate_crm_contacts(text,text,text,text) to authenticated;

create or replace function public.create_crm_contact(contact jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=(contact->>'organization_id')::uuid; actor uuid:=auth.uid(); patient uuid; lead uuid; duplicate uuid; selected_stage public.crm_pipeline_stages;
begin
  if actor is null or not public.can_access_organization_module(org,'crm','write') then raise exception 'Acesso negado ao CRM'; end if;
  if nullif(trim(contact->>'full_name'),'') is null then raise exception 'Informe o nome completo'; end if;
  if nullif(regexp_replace(coalesce(contact->>'phone',contact->>'whatsapp',''),'\D','','g'),'') is null then raise exception 'Informe telefone ou WhatsApp'; end if;
  select p.id into duplicate from public.patient_profiles p where p.organization_id=org and p.archived_at is null and (
    (nullif(regexp_replace(contact->>'cpf','\D','','g'),'') is not null and regexp_replace(coalesce(p.cpf,''),'\D','','g')=regexp_replace(contact->>'cpf','\D','','g')) or
    (nullif(regexp_replace(contact->>'phone','\D','','g'),'') is not null and regexp_replace(coalesce(p.phone,''),'\D','','g')=regexp_replace(contact->>'phone','\D','','g')) or
    (nullif(regexp_replace(contact->>'whatsapp','\D','','g'),'') is not null and regexp_replace(coalesce(p.whatsapp,''),'\D','','g')=regexp_replace(contact->>'whatsapp','\D','','g')) or
    (nullif(trim(contact->>'email'),'') is not null and lower(coalesce(p.email,''))=lower(trim(contact->>'email')))
  ) limit 1;
  if duplicate is not null then raise exception 'Já existe um cadastro possivelmente relacionado: %',duplicate; end if;
  if nullif(contact->>'stage_id','') is not null then
    select * into selected_stage from public.crm_pipeline_stages where id=(contact->>'stage_id')::uuid and organization_id=org and active and archived_at is null;
    if selected_stage.id is null then raise exception 'Etapa inicial inválida'; end if;
  end if;
  insert into public.patient_profiles(organization_id,full_name,social_name,cpf,rg,birth_date,gender,phone,whatsapp,email,postal_code,address_line,address_number,address_complement,neighborhood,city,state_code,notes,created_by)
  values(org,trim(contact->>'full_name'),nullif(trim(contact->>'social_name'),''),nullif(regexp_replace(contact->>'cpf','\D','','g'),''),nullif(trim(contact->>'rg'),''),nullif(contact->>'birth_date','')::date,nullif(trim(contact->>'gender'),''),nullif(trim(contact->>'phone'),''),nullif(trim(contact->>'whatsapp'),''),nullif(lower(trim(contact->>'email')),''),nullif(regexp_replace(contact->>'postal_code','\D','','g'),''),nullif(trim(contact->>'address_line'),''),nullif(trim(contact->>'address_number'),''),nullif(trim(contact->>'address_complement'),''),nullif(trim(contact->>'neighborhood'),''),nullif(trim(contact->>'city'),''),nullif(upper(trim(contact->>'state_code')),''),nullif(trim(contact->>'notes'),''),actor)
  returning id into patient;
  insert into public.leads(organization_id,patient_id,full_name,phone,email,source,status,pipeline_id,stage_id,assigned_professional_id,assigned_user_id,unit_id,service_id,interest,next_action,next_contact_at,notes,created_by)
  values(org,patient,trim(contact->>'full_name'),nullif(trim(coalesce(contact->>'whatsapp',contact->>'phone')),''),nullif(lower(trim(contact->>'email')),''),coalesce(nullif(trim(contact->>'source'),''),'Cadastro manual'),coalesce(selected_stage.legacy_status,'new'),selected_stage.pipeline_id,selected_stage.id,nullif(contact->>'assigned_professional_id','')::uuid,nullif(contact->>'assigned_user_id','')::uuid,nullif(contact->>'unit_id','')::uuid,nullif(contact->>'service_id','')::uuid,nullif(trim(contact->>'interest'),''),nullif(trim(contact->>'next_action'),''),nullif(contact->>'next_contact_at','')::timestamptz,nullif(trim(contact->>'notes'),''),actor)
  returning id into lead;
  insert into public.crm_interactions(organization_id,patient_id,lead_id,interaction_type,summary,created_by)
  values(org,patient,lead,'system','Cadastro criado no CRM',actor);
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(org,actor,'crm_contact_created','patient',patient,jsonb_build_object('lead_id',lead,'source',coalesce(contact->>'source','Cadastro manual')));
  return jsonb_build_object('patient_id',patient,'lead_id',lead);
end $$;
grant execute on function public.create_crm_contact(jsonb) to authenticated;

create or replace function public.record_financial_payment(target_entry_id uuid,payment_amount_cents bigint,target_payment_method_id uuid,target_cash_account_id uuid,idempotency_key text,payment_notes text default null)
returns public.financial_entries language plpgsql security definer set search_path='' as $$
declare entry public.financial_entries; total_paid bigint; fee bigint:=0; net bigint; method public.payment_methods;
begin
  select * into entry from public.financial_entries where id=target_entry_id for update;
  if entry.id is null then raise exception 'Lançamento não encontrado'; end if;
  if not public.can_access_organization_module(entry.organization_id,'finance','write') then raise exception 'Acesso negado ao financeiro'; end if;
  if payment_amount_cents<=0 then raise exception 'O valor deve ser maior que zero'; end if;
  if exists(select 1 from public.financial_transactions t where t.organization_id=entry.organization_id and t.idempotency_key=record_financial_payment.idempotency_key) then return entry; end if;
  if target_payment_method_id is not null then select * into method from public.payment_methods where id=target_payment_method_id and organization_id=entry.organization_id and active; end if;
  fee:=round(payment_amount_cents*coalesce(method.percentage_fee,0)/100)::bigint+coalesce(method.fixed_fee_cents,0);
  net:=greatest(payment_amount_cents-fee,0);
  insert into public.financial_transactions(organization_id,financial_entry_id,cash_account_id,payment_method_id,transaction_type,amount_cents,fee_cents,net_amount_cents,idempotency_key,notes,created_by)
  values(entry.organization_id,entry.id,target_cash_account_id,target_payment_method_id,case when entry.type in ('receivable','income') then 'receipt' else 'payment' end,payment_amount_cents,fee,net,idempotency_key,nullif(trim(payment_notes),''),auth.uid());
  select coalesce(sum(t.amount_cents),0) into total_paid from public.financial_transactions t where t.financial_entry_id=entry.id and t.transaction_type in ('receipt','payment');
  update public.financial_entries set received_amount_cents=total_paid,financial_fee_cents=financial_fee_cents+fee,net_received_cents=net_received_cents+net,
    status=case when total_paid>=amount_cents then 'paid'::public.financial_entry_status else 'partially_paid'::public.financial_entry_status end,
    paid_at=case when total_paid>=amount_cents then now() else paid_at end,updated_at=now()
  where id=entry.id returning * into entry;
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,metadata)
  values(entry.organization_id,auth.uid(),'financial_payment_recorded','financial_entry',entry.id,jsonb_build_object('amount_cents',payment_amount_cents,'fee_cents',fee,'transaction_status',entry.status));
  return entry;
end $$;
grant execute on function public.record_financial_payment(uuid,bigint,uuid,uuid,text,text) to authenticated;

-- Segurança multi-tenant e RBAC no banco.
do $$ declare table_name text; begin
  foreach table_name in array array['organization_units','crm_pipelines','crm_pipeline_stages','crm_lead_stage_history','crm_interactions','crm_tags','patient_tags','financial_categories','payment_methods','cost_centers','cash_accounts','financial_recurrence_rules','financial_transactions','professional_payouts','internal_notifications'] loop
    execute format('alter table public.%I enable row level security',table_name);
  end loop;
end $$;

drop policy if exists "units organization manage" on public.organization_units;
drop policy if exists "pipelines organization read" on public.crm_pipelines;
drop policy if exists "pipelines managers write" on public.crm_pipelines;
drop policy if exists "stages organization read" on public.crm_pipeline_stages;
drop policy if exists "stages managers write" on public.crm_pipeline_stages;
drop policy if exists "lead history organization read" on public.crm_lead_stage_history;
drop policy if exists "interactions organization manage" on public.crm_interactions;
drop policy if exists "tags organization manage" on public.crm_tags;
drop policy if exists "patient tags organization manage" on public.patient_tags;
drop policy if exists "financial categories organization manage" on public.financial_categories;
drop policy if exists "payment methods organization manage" on public.payment_methods;
drop policy if exists "cost centers organization manage" on public.cost_centers;
drop policy if exists "cash accounts organization manage" on public.cash_accounts;
drop policy if exists "recurrence organization manage" on public.financial_recurrence_rules;
drop policy if exists "transactions organization read" on public.financial_transactions;
drop policy if exists "payouts organization manage" on public.professional_payouts;
drop policy if exists "notifications organization read" on public.internal_notifications;
drop policy if exists "notifications organization update" on public.internal_notifications;

create policy "units organization manage" on public.organization_units for all to authenticated using(public.can_access_organization_module(organization_id,'settings','write')) with check(public.can_access_organization_module(organization_id,'settings','write'));
create policy "pipelines organization read" on public.crm_pipelines for select to authenticated using(public.can_access_organization_module(organization_id,'crm','read'));
create policy "pipelines managers write" on public.crm_pipelines for all to authenticated using(public.can_manage_organization(organization_id)) with check(public.can_manage_organization(organization_id));
create policy "stages organization read" on public.crm_pipeline_stages for select to authenticated using(public.can_access_organization_module(organization_id,'crm','read'));
create policy "stages managers write" on public.crm_pipeline_stages for all to authenticated using(public.can_manage_organization(organization_id)) with check(public.can_manage_organization(organization_id));
create policy "lead history organization read" on public.crm_lead_stage_history for select to authenticated using(public.can_access_organization_module(organization_id,'crm','read'));
create policy "interactions organization manage" on public.crm_interactions for all to authenticated using(public.can_access_organization_module(organization_id,'crm','read')) with check(public.can_access_organization_module(organization_id,'crm','write'));
create policy "tags organization manage" on public.crm_tags for all to authenticated using(public.can_access_organization_module(organization_id,'crm','read')) with check(public.can_access_organization_module(organization_id,'crm','write'));
create policy "patient tags organization manage" on public.patient_tags for all to authenticated using(public.can_access_organization_module(organization_id,'crm','read')) with check(public.can_access_organization_module(organization_id,'crm','write'));
create policy "financial categories organization manage" on public.financial_categories for all to authenticated using(public.can_access_organization_module(organization_id,'finance','read')) with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "payment methods organization manage" on public.payment_methods for all to authenticated using(public.can_access_organization_module(organization_id,'finance','read')) with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "cost centers organization manage" on public.cost_centers for all to authenticated using(public.can_access_organization_module(organization_id,'finance','read')) with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "cash accounts organization manage" on public.cash_accounts for all to authenticated using(public.can_access_organization_module(organization_id,'finance','read')) with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "recurrence organization manage" on public.financial_recurrence_rules for all to authenticated using(public.can_access_organization_module(organization_id,'finance','read')) with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "transactions organization read" on public.financial_transactions for select to authenticated using(public.can_access_organization_module(organization_id,'finance','read'));
create policy "payouts organization manage" on public.professional_payouts for all to authenticated using(public.can_access_organization_module(organization_id,'finance','read')) with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "notifications organization read" on public.internal_notifications for select to authenticated using(user_id=auth.uid() or (user_id is null and public.is_organization_member(organization_id)) or public.is_platform_admin());
create policy "notifications organization update" on public.internal_notifications for update to authenticated using(user_id=auth.uid() or public.can_manage_organization(organization_id)) with check(user_id=auth.uid() or public.can_manage_organization(organization_id));

drop policy if exists "patients organization read" on public.patient_profiles;
drop policy if exists "patients organization create" on public.patient_profiles;
drop policy if exists "patients organization update" on public.patient_profiles;
drop policy if exists "patients organization manage" on public.patient_profiles;
drop policy if exists "patients crm read" on public.patient_profiles;
drop policy if exists "patients crm create" on public.patient_profiles;
drop policy if exists "patients crm update" on public.patient_profiles;
create policy "patients crm read" on public.patient_profiles for select to authenticated using(public.can_access_organization_module(organization_id,'crm','read'));
create policy "patients crm create" on public.patient_profiles for insert to authenticated with check(created_by=auth.uid() and public.can_access_organization_module(organization_id,'crm','write'));
create policy "patients crm update" on public.patient_profiles for update to authenticated using(public.can_access_organization_module(organization_id,'crm','write')) with check(public.can_access_organization_module(organization_id,'crm','write'));

drop policy if exists "leads organization manage" on public.leads;
drop policy if exists "leads crm read" on public.leads;
drop policy if exists "leads crm create" on public.leads;
drop policy if exists "leads crm update" on public.leads;
create policy "leads crm read" on public.leads for select to authenticated using(public.can_access_organization_module(organization_id,'crm','read'));
create policy "leads crm create" on public.leads for insert to authenticated with check(public.can_access_organization_module(organization_id,'crm','write'));
create policy "leads crm update" on public.leads for update to authenticated using(public.can_access_organization_module(organization_id,'crm','write')) with check(public.can_access_organization_module(organization_id,'crm','write'));

drop policy if exists "financial entries organization manage" on public.financial_entries;
drop policy if exists "financial entries finance read" on public.financial_entries;
drop policy if exists "financial entries finance create" on public.financial_entries;
drop policy if exists "financial entries finance update" on public.financial_entries;
create policy "financial entries finance read" on public.financial_entries for select to authenticated using(public.can_access_organization_module(organization_id,'finance','read'));
create policy "financial entries finance create" on public.financial_entries for insert to authenticated with check(public.can_access_organization_module(organization_id,'finance','write'));
create policy "financial entries finance update" on public.financial_entries for update to authenticated using(public.can_access_organization_module(organization_id,'finance','write')) with check(public.can_access_organization_module(organization_id,'finance','write'));

grant select,insert,update on public.organization_units,public.crm_pipelines,public.crm_pipeline_stages,public.crm_interactions,public.crm_tags,public.patient_tags,public.financial_categories,public.payment_methods,public.cost_centers,public.cash_accounts,public.financial_recurrence_rules,public.professional_payouts,public.internal_notifications to authenticated;
grant select on public.crm_lead_stage_history,public.financial_transactions to authenticated;

-- Dados iniciais editáveis por organização.
insert into public.financial_categories(organization_id,name,kind)
select o.id,v.name,v.kind from public.organizations o cross join (values
 ('Consultas','revenue'),('Procedimentos','revenue'),('Exames','revenue'),('Terapias','revenue'),('Pacotes','revenue'),('Outros recebimentos','revenue'),
 ('Prestadores','direct_cost'),('Materiais e insumos','direct_cost'),('Taxas financeiras','financial_fee'),('Impostos','tax'),
 ('Aluguel','infrastructure'),('Energia','infrastructure'),('Água','infrastructure'),('Internet','infrastructure'),('Software','administrative'),
 ('Limpeza','operating_expense'),('Marketing','marketing'),('Contabilidade','administrative'),('Folha e benefícios','personnel'),('Manutenção','operating_expense')
) v(name,kind) on conflict do nothing;

insert into public.payment_methods(organization_id,name,method_type)
select o.id,v.name,v.kind from public.organizations o cross join (values
 ('Dinheiro','cash'),('Pix','pix'),('Débito','debit_card'),('Crédito','credit_card'),('Boleto','boleto'),('Transferência','bank_transfer'),('Convênio','insurance'),('Outros','other')
) v(name,kind) on conflict do nothing;

insert into public.cash_accounts(organization_id,name,account_type)
select id,'Caixa principal','cash' from public.organizations on conflict do nothing;
