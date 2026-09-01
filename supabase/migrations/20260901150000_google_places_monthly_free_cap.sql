-- Reserva atomicamente cada chamada ao Google Places e bloqueia novas chamadas
-- ao atingir a franquia mensal definida. O mês segue o calendário do Google
-- (America/Los_Angeles), independentemente do fuso do servidor.

create table if not exists public.google_places_monthly_usage (
  month_key date primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.google_places_monthly_usage enable row level security;
revoke all on public.google_places_monthly_usage from public, anon, authenticated;
grant select, insert, update on public.google_places_monthly_usage to service_role;

insert into public.google_places_monthly_usage(month_key, request_count)
select
  date_trunc('month', now() at time zone 'America/Los_Angeles')::date,
  count(*)::integer
from public.professional_research_runs
where source_name ilike 'Google Places%'
  and started_at >= (date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')
on conflict (month_key) do update
set request_count=greatest(public.google_places_monthly_usage.request_count, excluded.request_count), updated_at=now();

create or replace function public.consume_google_places_monthly_quota(requested_limit integer default 1000)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  current_month date := date_trunc('month', now() at time zone 'America/Los_Angeles')::date;
  consumed integer;
  safe_limit integer := least(greatest(coalesce(requested_limit,1000),1),1000);
begin
  insert into public.google_places_monthly_usage(month_key,request_count,updated_at)
  values(current_month,1,now())
  on conflict(month_key) do update
    set request_count=public.google_places_monthly_usage.request_count+1, updated_at=now()
    where public.google_places_monthly_usage.request_count < safe_limit
  returning request_count into consumed;
  return consumed is not null and consumed <= safe_limit;
end;
$$;

create or replace function public.google_places_monthly_quota_status(requested_limit integer default 1000)
returns table(month_key date, used_count integer, limit_count integer, remaining_count integer)
language sql
security definer
set search_path=''
as $$
  select current_month,
    coalesce(usage.request_count,0),
    safe_limit,
    greatest(safe_limit-coalesce(usage.request_count,0),0)
  from (
    select date_trunc('month', now() at time zone 'America/Los_Angeles')::date current_month,
           least(greatest(coalesce(requested_limit,1000),1),1000) safe_limit
  ) limits
  left join public.google_places_monthly_usage usage on usage.month_key=limits.current_month;
$$;

revoke all on function public.consume_google_places_monthly_quota(integer) from public, anon, authenticated;
revoke all on function public.google_places_monthly_quota_status(integer) from public, anon, authenticated;
grant execute on function public.consume_google_places_monthly_quota(integer) to service_role;
grant execute on function public.google_places_monthly_quota_status(integer) to service_role;
