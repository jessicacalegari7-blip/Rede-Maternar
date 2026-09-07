-- Auditoria completa das categorias históricas do diretório.
-- Preserva os vínculos antigos para histórico, mas usa apenas categorias canônicas nas buscas.
insert into public.specialties(name,slug,active) values
 ('Alergista e Imunologista Infantil','alergista-e-imunologista-infantil',true),
 ('Cardiologista Infantil','cardiologista-infantil',true),
 ('Cirurgião Pediátrico','cirurgiao-pediatrico',true),
 ('Consultora de Amamentação','consultora-de-amamentacao',true),
 ('Dermatologista Infantil','dermatologista-infantil',true),
 ('Enfermeira Obstétrica','enfermeira-obstetrica',true),
 ('Endocrinologista Infantil','endocrinologista-infantil',true),
 ('Fisioterapeuta Infantil','fisioterapeuta-infantil',true),
 ('Fonoaudióloga Infantil','fonoaudiologa-infantil',true),
 ('Gastroenterologista Infantil','gastroenterologista-infantil',true),
 ('Geneticista Infantil','geneticista-infantil',true),
 ('Ginecologista e Obstetra','ginecologista-e-obstetra',true),
 ('Hematologista Infantil','hematologista-infantil',true),
 ('Infectologista Infantil','infectologista-infantil',true),
 ('Musicoterapeuta Infantil','musicoterapeuta-infantil',true),
 ('Nefrologista Infantil','nefrologista-infantil',true),
 ('Neonatologista','neonatologista',true),
 ('Neurologista Infantil','neurologista-infantil',true),
 ('Neuropsicólogo Infantil','neuropsicologo-infantil',true),
 ('Nutricionista Infantil','nutricionista-infantil',true),
 ('Nutricionista Materno-Infantil','nutricionista-materno-infantil',true),
 ('Nutrólogo Infantil','nutrologo-infantil',true),
 ('Odontopediatra','odontopediatra',true),
 ('Oftalmologista Infantil','oftalmologista-infantil',true),
 ('Ortopedista Infantil','ortopedista-infantil',true),
 ('Otorrinolaringologista Infantil','otorrinolaringologista-infantil',true),
 ('Pediatria','pediatria',true),
 ('Pneumologista Infantil','pneumologista-infantil',true),
 ('Psicóloga Infantil','psicologa-infantil',true),
 ('Psicóloga Perinatal','psicologa-perinatal',true),
 ('Psiquiatra Infantil','psiquiatra-infantil',true),
 ('Reumatologista Infantil','reumatologista-infantil',true),
 ('Sono Infantil','sono-infantil',true),
 ('Terapeuta Ocupacional Infantil','terapeuta-ocupacional-infantil',true),
 ('Urologista Infantil','urologista-infantil',true),
 ('Laserterapia','laserterapia',true)
on conflict(slug) do update set name=excluded.name,active=true;

do $$
declare item record; canonical_id uuid; duplicate_id uuid;
begin
 for item in select * from (values
  ('alergologia-pediatrica','Alergista e Imunologista Infantil','alergista-e-imunologista-infantil'),
  ('cardiologia-pediatrica','Cardiologista Infantil','cardiologista-infantil'),('cardiologista-pediatrico','Cardiologista Infantil','cardiologista-infantil'),
  ('cirurgia-pediatrica','Cirurgião Pediátrico','cirurgiao-pediatrico'),
  ('consultoria-de-amamentacao','Consultora de Amamentação','consultora-de-amamentacao'),('consultor-de-amamentacao','Consultora de Amamentação','consultora-de-amamentacao'),('consultora-em-amamentacao','Consultora de Amamentação','consultora-de-amamentacao'),('consultoria-em-amamentacao','Consultora de Amamentação','consultora-de-amamentacao'),
  ('dermatologia-pediatrica','Dermatologista Infantil','dermatologista-infantil'),
  ('enfermagem-obstetrica','Enfermeira Obstétrica','enfermeira-obstetrica'),
  ('endocrinologia-pediatrica','Endocrinologista Infantil','endocrinologista-infantil'),
  ('fisioterapia-infantil','Fisioterapeuta Infantil','fisioterapeuta-infantil'),
  ('fono-infantil','Fonoaudióloga Infantil','fonoaudiologa-infantil'),('fonoaudiologia-infantil','Fonoaudióloga Infantil','fonoaudiologa-infantil'),
  ('gastro-pediatra','Gastroenterologista Infantil','gastroenterologista-infantil'),('gastropediatra','Gastroenterologista Infantil','gastroenterologista-infantil'),('gastroenterologia-pediatrica','Gastroenterologista Infantil','gastroenterologista-infantil'),
  ('genetica-medica','Geneticista Infantil','geneticista-infantil'),
  ('ginecologia-e-obstetricia','Ginecologista e Obstetra','ginecologista-e-obstetra'),
  ('hematologia-pediatrica','Hematologista Infantil','hematologista-infantil'),
  ('infectologia-pediatrica','Infectologista Infantil','infectologista-infantil'),
  ('musicoterapia-infantil','Musicoterapeuta Infantil','musicoterapeuta-infantil'),
  ('nefrologia-pediatrica','Nefrologista Infantil','nefrologista-infantil'),
  ('neuropediatra','Neurologista Infantil','neurologista-infantil'),('neuropediatria','Neurologista Infantil','neurologista-infantil'),('neurologia-pediatrica','Neurologista Infantil','neurologista-infantil'),('neurologista-pediatrico','Neurologista Infantil','neurologista-infantil'),
  ('neuropsicologia-infantil','Neuropsicólogo Infantil','neuropsicologo-infantil'),
  ('nutricao-infantil','Nutricionista Infantil','nutricionista-infantil'),('nutricao-materno-infantil','Nutricionista Materno-Infantil','nutricionista-materno-infantil'),
  ('nutrologia-pediatrica','Nutrólogo Infantil','nutrologo-infantil'),
  ('oftalmologia-pediatrica','Oftalmologista Infantil','oftalmologista-infantil'),
  ('ortopedia-pediatrica','Ortopedista Infantil','ortopedista-infantil'),
  ('otorrinolaringologia-pediatrica','Otorrinolaringologista Infantil','otorrinolaringologista-infantil'),
  ('pediatra','Pediatria','pediatria'),
  ('pneumologia-pediatrica','Pneumologista Infantil','pneumologista-infantil'),
  ('psicologia-infantil','Psicóloga Infantil','psicologa-infantil'),('psicologia-perinatal','Psicóloga Perinatal','psicologa-perinatal'),
  ('psiquiatria-infantil','Psiquiatra Infantil','psiquiatra-infantil'),
  ('reumatologia-pediatrica','Reumatologista Infantil','reumatologista-infantil'),
  ('especialista-do-sono','Sono Infantil','sono-infantil'),('especialista-em-sono-infantil','Sono Infantil','sono-infantil'),('sono-do-bebe','Sono Infantil','sono-infantil'),
  ('terapia-ocupacional-infantil','Terapeuta Ocupacional Infantil','terapeuta-ocupacional-infantil'),
  ('urologia-pediatrica','Urologista Infantil','urologista-infantil')
 ) a(alias_slug,canonical_name,canonical_slug) loop
  select id into canonical_id from public.specialties where slug=item.canonical_slug;
  select id into duplicate_id from public.specialties where slug=item.alias_slug and id<>canonical_id limit 1;
  if duplicate_id is not null then
   insert into public.professional_specialties(professional_id,specialty_id,is_primary)
    select professional_id,canonical_id,is_primary from public.professional_specialties where specialty_id=duplicate_id
    on conflict(professional_id,specialty_id) do update set is_primary=public.professional_specialties.is_primary or excluded.is_primary;
   update public.specialties set active=false where id=duplicate_id;
  end if;
  update public.clinic_prospects set primary_specialty=item.canonical_name,specialty_slug=item.canonical_slug,updated_at=now() where specialty_slug=item.alias_slug;
  update public.professional_research_targets set enabled=false,last_status='merged_into_'||item.canonical_slug where specialty_slug=item.alias_slug;
  duplicate_id:=null;
 end loop;
end $$;

create or replace function public.canonical_specialty_slug(value text) returns text language sql immutable parallel safe set search_path='' as $$
select case lower(coalesce(value,''))
 when 'alergologia-pediatrica' then 'alergista-e-imunologista-infantil' when 'cardiologia-pediatrica' then 'cardiologista-infantil' when 'cardiologista-pediatrico' then 'cardiologista-infantil'
 when 'cirurgia-pediatrica' then 'cirurgiao-pediatrico' when 'consultoria-de-amamentacao' then 'consultora-de-amamentacao' when 'consultor-de-amamentacao' then 'consultora-de-amamentacao' when 'consultora-em-amamentacao' then 'consultora-de-amamentacao' when 'consultoria-em-amamentacao' then 'consultora-de-amamentacao'
 when 'dermatologia-pediatrica' then 'dermatologista-infantil' when 'enfermagem-obstetrica' then 'enfermeira-obstetrica' when 'endocrinologia-pediatrica' then 'endocrinologista-infantil' when 'fisioterapia-infantil' then 'fisioterapeuta-infantil'
 when 'fono-infantil' then 'fonoaudiologa-infantil' when 'fonoaudiologia-infantil' then 'fonoaudiologa-infantil' when 'gastro-pediatra' then 'gastroenterologista-infantil' when 'gastropediatra' then 'gastroenterologista-infantil' when 'gastroenterologia-pediatrica' then 'gastroenterologista-infantil'
 when 'genetica-medica' then 'geneticista-infantil' when 'ginecologia-e-obstetricia' then 'ginecologista-e-obstetra' when 'hematologia-pediatrica' then 'hematologista-infantil' when 'infectologia-pediatrica' then 'infectologista-infantil' when 'musicoterapia-infantil' then 'musicoterapeuta-infantil'
 when 'nefrologia-pediatrica' then 'nefrologista-infantil' when 'neonatologia' then 'neonatologista' when 'neuropediatra' then 'neurologista-infantil' when 'neuropediatria' then 'neurologista-infantil' when 'neurologia-pediatrica' then 'neurologista-infantil' when 'neurologista-pediatrico' then 'neurologista-infantil'
 when 'neuropsicologia-infantil' then 'neuropsicologo-infantil' when 'nutricao-infantil' then 'nutricionista-infantil' when 'nutricao-materno-infantil' then 'nutricionista-materno-infantil' when 'nutrologia-pediatrica' then 'nutrologo-infantil'
 when 'odontopediatria' then 'odontopediatra' when 'oftalmologia-pediatrica' then 'oftalmologista-infantil' when 'ortopedia-pediatrica' then 'ortopedista-infantil' when 'otorrinolaringologia-pediatrica' then 'otorrinolaringologista-infantil' when 'pediatra' then 'pediatria'
 when 'pneumologia-pediatrica' then 'pneumologista-infantil' when 'psicologia-infantil' then 'psicologa-infantil' when 'psicologia-perinatal' then 'psicologa-perinatal' when 'psiquiatria-infantil' then 'psiquiatra-infantil' when 'reumatologia-pediatrica' then 'reumatologista-infantil'
 when 'especialista-do-sono' then 'sono-infantil' when 'especialista-em-sono-infantil' then 'sono-infantil' when 'sono-do-bebe' then 'sono-infantil' when 'terapia-ocupacional-infantil' then 'terapeuta-ocupacional-infantil' when 'urologia-pediatrica' then 'urologista-infantil'
 else lower(coalesce(value,'')) end; $$;
