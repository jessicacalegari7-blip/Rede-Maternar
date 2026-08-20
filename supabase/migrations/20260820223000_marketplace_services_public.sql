create or replace view public.marketplace_services
with (security_invoker = false, security_barrier = true) as
select s.id, pp.id as professional_profile_id, s.name, s.description,
  s.duration_minutes, s.price_cents, s.attendance_modes, s.specialty,
  s.professional_name, s.professional_registration, s.city, s.neighborhood
from public.services s
join public.organizations o on o.id=s.organization_id and o.status='active'
join public.professional_profiles pp on pp.organization_id=s.organization_id and pp.marketplace_visible
where s.active and s.marketplace_visible;

revoke all on public.marketplace_services from public;
grant select on public.marketplace_services to anon, authenticated;
