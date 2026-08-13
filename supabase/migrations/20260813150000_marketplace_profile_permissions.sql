-- Permissões finais para o editor real do perfil e serviços públicos.
alter table public.professional_profiles
  add column if not exists facebook_url text,
  add column if not exists tiktok_url text;

grant select on public.professional_profiles to authenticated;
grant update (full_name,professional_registration,bio,whatsapp,email,city,state_code,neighborhood,clinic_name,
accepts_online,website_url,instagram_handle,facebook_url,tiktok_url,accepted_insurances,payment_methods,profile_completed,
profile_image_url,cover_image_url,office_video_url,gallery_urls,clinic_description,opening_hours,
postal_code,address_line,address_number,address_complement) on public.professional_profiles to authenticated;

drop policy if exists "professional profiles public or member read" on public.professional_profiles;
create policy "professional profiles public or member read" on public.professional_profiles for select to anon, authenticated
using (marketplace_visible or user_id=auth.uid() or public.is_organization_member(organization_id) or public.is_platform_admin());

drop policy if exists "professional profiles owner manager update" on public.professional_profiles;
create policy "professional profiles owner manager update" on public.professional_profiles for update to authenticated
using (user_id=auth.uid() or public.can_manage_organization(organization_id) or public.is_platform_admin())
with check (user_id=auth.uid() or public.can_manage_organization(organization_id) or public.is_platform_admin());

grant select,insert,update on public.services to authenticated;
grant select on public.services to anon;
