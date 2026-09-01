-- Mantém a lista de especialidades sincronizada com tudo que o diretório já
-- encontrou e impede duas execuções próximas de processarem o mesmo alvo.

insert into public.specialties (name, slug, active)
select distinct trim(primary_specialty), trim(specialty_slug), true
from public.clinic_prospects
where nullif(trim(primary_specialty), '') is not null
  and nullif(trim(specialty_slug), '') is not null
on conflict (slug) do update set name=excluded.name, active=true;

create or replace function public.claim_professional_research_targets(requested_limit integer default 1)
returns setof public.professional_research_targets
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  with selected as (
    select target.id
    from public.professional_research_targets target
    where target.enabled
      and (target.last_status is distinct from 'running' or target.last_run_at < now() - interval '10 minutes')
    order by target.last_run_at asc nulls first, target.priority, target.id
    for update skip locked
    limit least(greatest(coalesce(requested_limit,1),1),10)
  ), claimed as (
    update public.professional_research_targets target
    set last_run_at=now(), last_status='running'
    from selected
    where target.id=selected.id
    returning target.*
  )
  select * from claimed order by priority, id;
end;
$$;

revoke all on function public.claim_professional_research_targets(integer) from public, anon, authenticated;
grant execute on function public.claim_professional_research_targets(integer) to service_role;
