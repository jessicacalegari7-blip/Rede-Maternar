-- Uma origem gera um único lançamento financeiro, mesmo sob retry ou duplo clique.
alter table public.financial_entries
  add column if not exists source_type text,
  add column if not exists source_id text;

create unique index if not exists financial_entries_unique_source
  on public.financial_entries(organization_id,source_type,source_id)
  where source_type is not null and source_id is not null;

create or replace function public.record_appointment_payment(target_appointment_id uuid,payment_method_name text)
returns public.financial_entries language plpgsql security definer set search_path='' as $$
declare appointment public.appointments; entry public.financial_entries; patient_name text;
begin
  select * into appointment from public.appointments where id=target_appointment_id for update;
  if appointment.id is null then raise exception 'Atendimento não encontrado'; end if;
  if not public.can_access_organization_module(appointment.organization_id,'finance','write') then raise exception 'Acesso negado ao financeiro'; end if;
  if appointment.status='cancelled' then raise exception 'Atendimento cancelado não pode ser recebido'; end if;
  select full_name into patient_name from public.patient_profiles where id=appointment.patient_id;
  insert into public.financial_entries(organization_id,patient_id,appointment_id,professional_id,service_id,unit_id,type,status,category,description,amount_cents,gross_amount_cents,competence_date,due_date,payment_method,created_by,source_type,source_id)
  values(appointment.organization_id,appointment.patient_id,appointment.id,appointment.professional_id,appointment.service_id,appointment.unit_id,'receivable','pending','Atendimento','Atendimento — '||coalesce(patient_name,'Paciente'),appointment.price_cents,appointment.price_cents,appointment.starts_at::date,appointment.starts_at::date,nullif(trim(payment_method_name),''),auth.uid(),'appointment',appointment.id::text)
  on conflict (organization_id,source_type,source_id) where source_type is not null and source_id is not null
  do update set amount_cents=excluded.amount_cents,gross_amount_cents=excluded.gross_amount_cents,professional_id=excluded.professional_id,service_id=excluded.service_id,unit_id=excluded.unit_id,payment_method=excluded.payment_method,updated_at=now()
  returning * into entry;
  if appointment.price_cents>0 and entry.status not in ('paid','refunded','cancelled') then
    entry:=public.record_financial_payment(entry.id,appointment.price_cents,null,null,'appointment-payment:'||appointment.id::text,'Pagamento confirmado no atendimento');
  end if;
  update public.appointments set status='completed',payment_method=nullif(trim(payment_method_name),''),attended_at=coalesce(attended_at,now()),updated_at=now() where id=appointment.id;
  return entry;
end $$;
grant execute on function public.record_appointment_payment(uuid,text) to authenticated;

-- Persiste todos os locais e as cidades do Marketplace em uma única transação.
create or replace function public.save_professional_service_locations(target_professional_id uuid,location_rows jsonb)
returns setof public.professional_service_locations language plpgsql security definer set search_path='' as $$
declare profile public.professional_profiles; item jsonb; location_id uuid; kept_ids uuid[]:='{}'; position integer:=0; first_location public.professional_service_locations;
begin
  select * into profile from public.professional_profiles where id=target_professional_id;
  if profile.id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if not (public.is_organization_member(profile.organization_id) or public.is_platform_admin()) then raise exception 'Acesso negado ao perfil'; end if;
  if jsonb_typeof(location_rows)<>'array' then raise exception 'Lista de locais inválida'; end if;
  for item in select value from jsonb_array_elements(location_rows) loop
    position:=position+1;
    if length(trim(coalesce(item->>'name','')))<2 or length(trim(coalesce(item->>'address_line','')))<2 or trim(coalesce(item->>'city',''))='' or length(trim(coalesce(item->>'state_code','')))<>2 then
      raise exception 'Preencha nome, endereço, cidade e UF de todos os locais de atendimento';
    end if;
    location_id:=nullif(item->>'id','')::uuid;
    if location_id is not null then
      update public.professional_service_locations set name=trim(item->>'name'),address_line=trim(item->>'address_line'),address_number=nullif(trim(item->>'address_number'),''),address_complement=nullif(trim(item->>'address_complement'),''),neighborhood=nullif(trim(item->>'neighborhood'),''),city=trim(item->>'city'),state_code=upper(trim(item->>'state_code'))::char(2),postal_code=nullif(regexp_replace(item->>'postal_code','\D','','g'),''),sort_order=position-1,active=true,updated_at=now()
      where id=location_id and professional_id=target_professional_id returning id into location_id;
      if location_id is null then raise exception 'Local de atendimento inválido'; end if;
    else
      insert into public.professional_service_locations(professional_id,name,address_line,address_number,address_complement,neighborhood,city,state_code,postal_code,sort_order,active)
      values(target_professional_id,trim(item->>'name'),trim(item->>'address_line'),nullif(trim(item->>'address_number'),''),nullif(trim(item->>'address_complement'),''),nullif(trim(item->>'neighborhood'),''),trim(item->>'city'),upper(trim(item->>'state_code'))::char(2),nullif(regexp_replace(item->>'postal_code','\D','','g'),''),position-1,true) returning id into location_id;
    end if;
    kept_ids:=array_append(kept_ids,location_id);
  end loop;
  delete from public.professional_service_locations where professional_id=target_professional_id and not(id=any(kept_ids));
  delete from public.professional_service_cities where professional_id=target_professional_id;
  insert into public.professional_service_cities(professional_id,city,state_code,is_primary,active)
  select target_professional_id,city,state_code,(row_number() over(order by min(sort_order),city)=1),true from public.professional_service_locations where professional_id=target_professional_id and active group by city,state_code on conflict(professional_id,city,state_code) do update set active=true,is_primary=excluded.is_primary;
  select * into first_location from public.professional_service_locations where professional_id=target_professional_id and active order by sort_order,id limit 1;
  if first_location.id is not null then update public.professional_profiles set address_line=first_location.address_line,address_number=first_location.address_number,address_complement=first_location.address_complement,neighborhood=first_location.neighborhood,city=first_location.city,state_code=first_location.state_code,postal_code=first_location.postal_code,updated_at=now() where id=target_professional_id; end if;
  return query select * from public.professional_service_locations where professional_id=target_professional_id and active order by sort_order,id;
end $$;
grant execute on function public.save_professional_service_locations(uuid,jsonb) to authenticated;
