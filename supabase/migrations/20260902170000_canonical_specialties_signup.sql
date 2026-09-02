insert into public.specialties(name,slug,active) values
 ('Cardiologista Infantil','cardiologista-infantil',true),('Neurologista Infantil','neurologista-infantil',true),
 ('Sono Infantil','sono-infantil',true),('Laserterapia','laserterapia',true)
on conflict(slug) do update set name=excluded.name,active=true;

do $$ declare item record;canonical_id uuid;duplicate_id uuid; begin
 for item in select * from (values
  ('Cardiologista Pediátrico','cardiologista-infantil'),('Cardiologia Pediátrica','cardiologista-infantil'),
  ('Neuropediatra','neurologista-infantil'),('Neuropediatria','neurologista-infantil'),('Neurologia Pediátrica','neurologista-infantil'),
  ('Especialista do Sono','sono-infantil'),('Especialista em Sono Infantil','sono-infantil'),('Sono do Bebê','sono-infantil')
 ) a(alias_name,canonical_slug) loop
  select id into canonical_id from public.specialties where slug=item.canonical_slug;
  select id into duplicate_id from public.specialties where lower(name)=lower(item.alias_name) and id<>canonical_id limit 1;
  if duplicate_id is not null then
   insert into public.professional_specialties(professional_id,specialty_id,is_primary)
    select professional_id,canonical_id,is_primary from public.professional_specialties where specialty_id=duplicate_id
    on conflict(professional_id,specialty_id) do update set is_primary=public.professional_specialties.is_primary or excluded.is_primary;
   update public.specialties set active=false where id=duplicate_id;
  end if;
  duplicate_id:=null;
 end loop;
end $$;

update public.clinic_prospects set primary_specialty='Cardiologista Infantil',specialty_slug='cardiologista-infantil',updated_at=now() where specialty_slug in('cardiologista-pediatrico','cardiologia-pediatrica');
update public.clinic_prospects set primary_specialty='Neurologista Infantil',specialty_slug='neurologista-infantil',updated_at=now() where specialty_slug in('neuropediatra','neuropediatria','neurologia-pediatrica');
update public.clinic_prospects set primary_specialty='Sono Infantil',specialty_slug='sono-infantil',updated_at=now() where specialty_slug in('especialista-do-sono','especialista-em-sono-infantil','sono-do-bebe');
update public.professional_research_targets set enabled=false where specialty_slug in('cardiologista-pediatrico','cardiologia-pediatrica','neuropediatra','neuropediatria','neurologia-pediatrica','especialista-do-sono','especialista-em-sono-infantil','sono-do-bebe');
