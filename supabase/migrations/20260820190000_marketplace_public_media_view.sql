-- Expõe no perfil público todos os campos editáveis já persistidos pela profissional.
create or replace view public.marketplace_professionals as
select
  pp.id, pp.full_name, pp.bio, pp.whatsapp, pp.email, pp.city, pp.state_code,
  pp.neighborhood, pp.clinic_name, pp.accepts_online, pp.verified, pp.rating,
  pp.review_count, pp.accepted_insurances, pp.payment_methods,
  o.plan::text as plan,
  coalesce(array_agg(distinct s.name) filter (where s.id is not null), '{}') as specialties,
  pp.profile_image_url, pp.cover_image_url, pp.office_video_url, pp.gallery_urls,
  pp.clinic_description, pp.opening_hours, pp.website_url, pp.instagram_handle,
  pp.facebook_url, pp.tiktok_url, pp.office_video_urls
from public.professional_profiles pp
join public.organizations o on o.id = pp.organization_id
left join public.professional_specialties ps on ps.professional_id = pp.id
left join public.specialties s on s.id = ps.specialty_id
where pp.marketplace_visible and o.status = 'active'
group by pp.id, o.plan;

grant select on public.marketplace_professionals to anon, authenticated;

grant update (profile_image_url, cover_image_url, gallery_urls, office_video_url, office_video_urls)
on public.professional_profiles to authenticated;
