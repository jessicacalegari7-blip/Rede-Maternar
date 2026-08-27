-- RLS policies for public portal tables call is_platform_admin() even for
-- anonymous visitors. EXECUTE must therefore be available to both API roles;
-- the function itself only returns a boolean and does not expose profile data.
revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to anon, authenticated, service_role;

-- Keep the platform owner recoverable even if an older signup trigger created
-- the profile without the administrative flag.
update public.profiles p
set is_platform_admin = true,
    status = 'active'::public.account_status,
    updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = 'jessica.calegari7@gmail.com';

