create table if not exists public.editorial_topics (
 id uuid primary key default gen_random_uuid(), title text not null, why_now text not null default '',
 editorial_score numeric not null default 0, status text not null default 'discovered', topic_hash text not null unique,
 discovered_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.editorial_sources (
 id uuid primary key default gen_random_uuid(), url text not null unique, publisher text not null,
 publication_date timestamptz, source_type text not null, trust_level integer not null check(trust_level between 1 and 5), metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.editorial_runs (
 id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null default 'running', estimated_cost numeric not null default 0, metrics jsonb not null default '{}'::jsonb,
 error_message text
);
create table if not exists public.editorial_article_audits (
 id uuid primary key default gen_random_uuid(), article_id uuid references public.news_articles(id) on delete cascade,
 topic_id uuid references public.editorial_topics(id), run_id uuid references public.editorial_runs(id),
 research_dossier jsonb not null default '{}'::jsonb, source_urls jsonb not null default '[]'::jsonb,
 fact_check jsonb not null default '[]'::jsonb, quality_gate text not null,
 technical_review_pending boolean not null default true, generated_by_ai boolean not null default true,
 model_name text, prompt_version text not null default 'materplace-master-v1', warnings jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.editorial_feedback (
 id uuid primary key default gen_random_uuid(), audit_id uuid not null references public.editorial_article_audits(id) on delete cascade,
 editor_id uuid not null references auth.users(id), decision text not null check(decision in ('approved','edited','rejected','duplicate','bad_topic','weak_sources','technical_problem')),
 notes text, created_at timestamptz not null default now()
);
alter table public.editorial_topics enable row level security;
alter table public.editorial_sources enable row level security;
alter table public.editorial_runs enable row level security;
alter table public.editorial_article_audits enable row level security;
alter table public.editorial_feedback enable row level security;
do $$ begin
 create policy "editorial admin topics" on public.editorial_topics for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
 create policy "editorial admin sources" on public.editorial_sources for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
 create policy "editorial admin runs" on public.editorial_runs for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
 create policy "editorial admin audits" on public.editorial_article_audits for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
 create policy "editorial admin feedback" on public.editorial_feedback for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
exception when duplicate_object then null; end $$;
grant select,insert,update,delete on public.editorial_topics,public.editorial_sources,public.editorial_runs,public.editorial_article_audits,public.editorial_feedback to authenticated;

