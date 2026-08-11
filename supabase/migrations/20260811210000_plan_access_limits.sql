create or replace function public.enforce_professional_specialty_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare selected_plan public.plan_code;
begin
  select o.plan into selected_plan
  from public.professional_profiles pp
  join public.organizations o on o.id = pp.organization_id
  where pp.id = new.professional_id;

  if selected_plan <> 'clinic'
    and (select count(*) from public.professional_specialties ps where ps.professional_id = new.professional_id) >= 3
  then
    raise exception 'Este plano permite no máximo 3 especialidades';
  end if;
  return new;
end;
$$;

drop trigger if exists professional_specialty_plan_limit on public.professional_specialties;
create trigger professional_specialty_plan_limit
before insert on public.professional_specialties
for each row execute function public.enforce_professional_specialty_limit();
