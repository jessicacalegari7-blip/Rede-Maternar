-- Cria automaticamente a organização e o perfil quando uma profissional se cadastra.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
  new_professional_id uuid;
  selected_specialty_id uuid;
  selected_plan public.plan_code;
  selected_type public.organization_type;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  if new.raw_user_meta_data ->> 'account_type' = 'professional' then
    selected_plan := case
      when new.raw_user_meta_data ->> 'plan' in ('free', 'marketplace', 'independent', 'clinic')
        then (new.raw_user_meta_data ->> 'plan')::public.plan_code
      else 'free'::public.plan_code
    end;
    selected_type := case
      when selected_plan = 'clinic' then 'clinic'::public.organization_type
      else 'independent'::public.organization_type
    end;

    insert into public.organizations (type, display_name, plan, status, created_by)
    values (
      selected_type,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), trim(new.raw_user_meta_data ->> 'full_name')),
      selected_plan,
      'pending',
      new.id
    )
    returning id into new_organization_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (new_organization_id, new.id, 'owner');

    insert into public.professional_profiles (
      organization_id, user_id, full_name, professional_registration, whatsapp,
      city, state_code, clinic_name, marketplace_visible
    )
    values (
      new_organization_id,
      new.id,
      trim(new.raw_user_meta_data ->> 'full_name'),
      nullif(trim(new.raw_user_meta_data ->> 'professional_registration'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'city'), ''), 'Não informada'),
      coalesce(nullif(upper(trim(new.raw_user_meta_data ->> 'state_code')), ''), 'SP'),
      case when selected_type = 'clinic'
        then coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), trim(new.raw_user_meta_data ->> 'full_name'))
        else null
      end,
      false
    )
    returning id into new_professional_id;

    select id into selected_specialty_id
    from public.specialties
    where name = new.raw_user_meta_data ->> 'specialty'
    limit 1;

    if selected_specialty_id is not null then
      insert into public.professional_specialties (professional_id, specialty_id, is_primary)
      values (new_professional_id, selected_specialty_id, true);
    end if;
  end if;

  return new;
end;
$$;
