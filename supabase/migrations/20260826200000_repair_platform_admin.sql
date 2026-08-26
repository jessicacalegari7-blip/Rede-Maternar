-- Garante que a conta administrativa oficial seja reconhecida pelo banco,
-- inclusive quando o perfil foi criado depois das migrations iniciais.

update public.profiles p
set is_platform_admin = true,
    status = 'active'::public.account_status,
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = 'jessica.calegari7@gmail.com';

insert into public.profiles (id, full_name, status, is_platform_admin)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'Jessica Calegari'),
       'active'::public.account_status,
       true
from auth.users u
where lower(u.email) = 'jessica.calegari7@gmail.com'
on conflict (id) do update set
  is_platform_admin = true,
  status = 'active'::public.account_status,
  updated_at = now();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') = 'jessica.calegari7@gmail.com'
    or (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
