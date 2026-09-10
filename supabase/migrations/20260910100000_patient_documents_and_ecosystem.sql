-- Evolucao incremental: documentos do paciente e pilares publicos MaterPlace.
create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patient_profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  document_type text not null check (document_type in ('prescription','certificate','invoice','attachment')),
  title text not null,
  content text,
  document_number text,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  status text not null default 'draft' check (status in ('draft','pending','issued','cancelled')),
  file_url text,
  issued_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_items (
  id uuid primary key default gen_random_uuid(), owner_organization_id uuid references public.organizations(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null, name text not null, slug text not null unique,
  description text not null, category text not null, price_cents bigint not null check(price_cents >= 0), image_url text,
  item_condition text check(item_condition in ('new','used')), city text, state_code char(2), contact_url text,
  status text not null default 'pending_review' check(status in ('draft','pending_review','published','rejected','archived','sold')),
  featured boolean not null default false, demo boolean not null default false, published_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete set null,
  professional_id uuid references public.professional_profiles(id) on delete set null, name text not null, slug text not null unique,
  description text not null, category text not null, audience text not null check(audience in ('families','professionals')),
  price_cents bigint not null default 0 check(price_cents >= 0), image_url text, instructor_name text not null, contact_url text,
  status text not null default 'pending_review' check(status in ('draft','pending_review','published','rejected','archived')),
  featured boolean not null default false, demo boolean not null default false, published_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete set null,
  professional_id uuid references public.professional_profiles(id) on delete set null, title text not null, slug text not null unique,
  company_name text not null, city text not null, state_code char(2) not null, workplace_type text not null check(workplace_type in ('onsite','hybrid','remote')),
  employment_type text not null check(employment_type in ('clt','pj','self_employed','internship','temporary','other')),
  description text not null, requirements text, benefits text, application_url text not null, expires_at timestamptz,
  status text not null default 'pending_review' check(status in ('draft','pending_review','published','rejected','archived')),
  featured boolean not null default false, demo boolean not null default false, published_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists patient_documents_patient_date_idx on public.patient_documents(patient_id,created_at desc);
create index if not exists marketplace_items_public_idx on public.marketplace_items(status,published_at desc);
create index if not exists courses_public_idx on public.courses(status,audience,published_at desc);
create index if not exists jobs_public_idx on public.jobs(status,city,state_code,published_at desc);

alter table public.patient_documents enable row level security;
alter table public.marketplace_items enable row level security;
alter table public.courses enable row level security;
alter table public.jobs enable row level security;

create policy "patient documents organization read" on public.patient_documents for select to authenticated
using(public.can_access_organization_module(organization_id,'crm','read'));
create policy "patient documents organization write" on public.patient_documents for all to authenticated
using(public.can_access_organization_module(organization_id,'crm','write'))
with check(public.can_access_organization_module(organization_id,'crm','write') and created_by=auth.uid());
create policy "published marketplace public read" on public.marketplace_items for select to anon,authenticated using(status='published');
create policy "published courses public read" on public.courses for select to anon,authenticated using(status='published');
create policy "published jobs public read" on public.jobs for select to anon,authenticated using(status='published' and (expires_at is null or expires_at>now()));
create policy "ecosystem admin manage marketplace" on public.marketplace_items for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy "ecosystem admin manage courses" on public.courses for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy "ecosystem admin manage jobs" on public.jobs for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy "owners manage marketplace submissions" on public.marketplace_items for all to authenticated using(owner_user_id=auth.uid()) with check(owner_user_id=auth.uid() and status in ('draft','pending_review','archived','sold'));
create policy "organizations manage course submissions" on public.courses for all to authenticated using(organization_id is not null and public.can_access_organization_module(organization_id,'marketplace','read')) with check(organization_id is not null and public.can_access_organization_module(organization_id,'marketplace','write') and status in ('draft','pending_review','archived'));
create policy "organizations manage job submissions" on public.jobs for all to authenticated using(organization_id is not null and public.can_access_organization_module(organization_id,'marketplace','read')) with check(organization_id is not null and public.can_access_organization_module(organization_id,'marketplace','write') and status in ('draft','pending_review','archived'));

grant select on public.marketplace_items,public.courses,public.jobs to anon,authenticated;
grant insert,update on public.marketplace_items,public.courses,public.jobs to authenticated;
grant select,insert,update on public.patient_documents to authenticated;

-- Dados demonstrativos aparecem apenas quando a respectiva area ainda esta vazia.
insert into public.marketplace_items(name,slug,description,category,price_cents,item_condition,status,featured,demo,published_at)
select v.name,v.slug,v.description,v.category,v.price,'new','published',v.featured,true,now() from (values
 ('Almofada de amamentação','almofada-amamentacao-demonstracao','Apoio ergonômico para tornar a amamentação mais confortável.','Amamentação',14990,true),
 ('Mochila maternidade','mochila-maternidade-demonstracao','Organização prática para passeios e rotina com o bebê.','Passeio',21990,false),
 ('Carrinho infantil — desapego','carrinho-infantil-desapego-demonstracao','Item demonstrativo de desapego em bom estado.','Desapegos',65000,false)
) v(name,slug,description,category,price,featured) where not exists(select 1 from public.marketplace_items);

insert into public.courses(name,slug,description,category,audience,price_cents,instructor_name,status,featured,demo,published_at)
select v.name,v.slug,v.description,'Amamentação',v.audience,v.price,'Equipe MaterPlace','published',v.featured,true,now() from (values
 ('Preparação para a amamentação','preparacao-amamentacao-demonstracao','Orientações introdutórias para famílias que desejam se preparar para a amamentação.','families',19700,true),
 ('Atualização em manejo clínico da lactação','manejo-clinico-lactacao-demonstracao','Conteúdo demonstrativo de atualização para profissionais.','professionals',39700,false)
) v(name,slug,description,audience,price,featured) where not exists(select 1 from public.courses);

insert into public.jobs(title,slug,company_name,city,state_code,workplace_type,employment_type,description,requirements,application_url,status,featured,demo,published_at)
select v.title,v.slug,'Clínica Materno Infantil','São Paulo','SP','onsite',v.kind,v.description,v.requirements,'mailto:contato@materplace.com.br','published',v.featured,true,now() from (values
 ('Pediatra','pediatra-clinica-demonstracao','Oportunidade demonstrativa para atendimento materno-infantil.','Registro profissional ativo.','pj',true),
 ('Fonoaudiólogo Pediátrico','fonoaudiologo-pediatrico-demonstracao','Oportunidade demonstrativa para atendimento presencial.','Formação e registro profissional compatíveis.','clt',false)
) v(title,slug,description,requirements,kind,featured) where not exists(select 1 from public.jobs);
