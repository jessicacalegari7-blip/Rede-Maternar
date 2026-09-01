create table if not exists public.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  reviewer_name text not null check (char_length(reviewer_name) between 2 and 100),
  reviewer_email text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, reviewer_email)
);

alter table public.professional_reviews enable row level security;
revoke all on public.professional_reviews from public, anon, authenticated;
grant select, insert, update on public.professional_reviews to service_role;

create or replace view public.public_professional_reviews as
select id, professional_id, reviewer_name, rating, comment, created_at
from public.professional_reviews;
grant select on public.public_professional_reviews to anon, authenticated;

create or replace function public.refresh_professional_review_summary(target_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.professional_profiles
  set rating=coalesce((select round(avg(r.rating)::numeric,1) from public.professional_reviews r where r.professional_id=target_id),0),
      review_count=(select count(*) from public.professional_reviews r where r.professional_id=target_id),
      updated_at=now()
  where id=target_id;
$$;

create or replace function public.submit_professional_review(target_professional_id uuid, reviewer_name text, reviewer_email text, review_rating integer, review_comment text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare review_id uuid; clean_email text:=lower(trim(reviewer_email));
begin
  if char_length(trim(reviewer_name)) < 2 then raise exception 'Informe seu nome.'; end if;
  if clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Informe um e-mail válido.'; end if;
  if review_rating not between 1 and 5 then raise exception 'A nota deve ser de 1 a 5.'; end if;
  if not exists(select 1 from public.professional_profiles where id=target_professional_id and marketplace_visible) then raise exception 'Perfil não disponível.'; end if;
  insert into public.professional_reviews(professional_id,reviewer_name,reviewer_email,rating,comment)
  values(target_professional_id,trim(reviewer_name),clean_email,review_rating,nullif(trim(review_comment),''))
  on conflict(professional_id,reviewer_email) do update set reviewer_name=excluded.reviewer_name,rating=excluded.rating,comment=excluded.comment,updated_at=now()
  returning id into review_id;
  perform public.refresh_professional_review_summary(target_professional_id);
  return review_id;
end; $$;

revoke all on function public.submit_professional_review(uuid,text,text,integer,text) from public;
grant execute on function public.submit_professional_review(uuid,text,text,integer,text) to anon, authenticated, service_role;

-- Perfil premium inaugural confirmado pela administração.
update public.professional_profiles
set verified=true, marketplace_visible=true, city='São Paulo', state_code='SP', neighborhood='Vila Carrão', updated_at=now()
where id='d55a16b2-71fc-4936-b23c-068870ebced3';

update public.organizations
set status='active', updated_at=now()
where id=(select organization_id from public.professional_profiles where id='d55a16b2-71fc-4936-b23c-068870ebced3');

update public.profiles
set status='active', updated_at=now()
where id=(select user_id from public.professional_profiles where id='d55a16b2-71fc-4936-b23c-068870ebced3');
