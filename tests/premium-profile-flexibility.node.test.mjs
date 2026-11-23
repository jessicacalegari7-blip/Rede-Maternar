import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const profile=fs.readFileSync(new URL('../src/pages/professional/Profile.tsx',import.meta.url),'utf8')
const publicProfile=fs.readFileSync(new URL('../src/pages/public/PublicProfessionalProfile.tsx',import.meta.url),'utf8')
const landing=fs.readFileSync(new URL('../src/pages/public/PremiumLanding.tsx',import.meta.url),'utf8')
const operations=fs.readFileSync(new URL('../src/lib/operations.ts',import.meta.url),'utf8')
const plans=fs.readFileSync(new URL('../src/lib/plans.ts',import.meta.url),'utf8')
const css=fs.readFileSync(new URL('../src/styles/global.css',import.meta.url),'utf8')
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const portalLayout=fs.readFileSync(new URL('../src/layouts/PortalLayout.tsx',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../supabase/migrations/20261118120000_premium_profile_flexibility.sql',import.meta.url),'utf8')
const serviceModesMigration=fs.readFileSync(new URL('../supabase/migrations/20261123193000_profile_service_attendance_modes.sql',import.meta.url),'utf8')

test('modalidades usam cidade e UF sem criar endereço físico paralelo',()=>{
  assert.match(profile,/Atendimento presencial em clínica ou consultório/)
  assert.match(profile,/Atendimento em domicílio/);assert.match(profile,/Atendimento online/)
  assert.match(profile,/Para atendimento online ou domiciliar, informe cidade e UF/)
  assert.match(operations,/save_professional_service_area/)
  assert.match(migration,/not location_managed/)
  assert.match(publicProfile,/profile\.accepts_in_person!==false/)
})

test('serviços opcionais reutilizam a tabela existente e ocultam seção vazia',()=>{
  assert.match(profile,/Serviços e procedimentos/);assert.match(profile,/Adicionar serviço/)
  assert.match(profile,/id="servicos"/);assert.doesNotMatch(portalLayout,/Serviços do perfil/)
  assert.match(app,/PlanGate requires="management"[^]*Route path="servicos"/)
  assert.doesNotMatch(profile,/Valor do atendimento \(R\$\)[^<]*<\/span><input[^>]*required/)
  assert.match(migration,/insert into public\.services/);assert.doesNotMatch(migration,/create table[^;]+services/i)
  assert.match(publicProfile,/services\.length>0&&/)
  assert.match(migration,/professional_id is null or s\.professional_id=pp\.id/)
})

test('cada serviço aceita múltiplas modalidades independentes',()=>{
  assert.match(profile,/Modalidades deste serviço/)
  assert.match(profile,/\['presencial','Consultório'\],\['online','Online'\],\['domiciliar','À domicílio'\]/)
  assert.match(operations,/attendance_modes:service\.attendanceModes/)
  assert.match(serviceModesMigration,/attendance_modes=modes/)
  assert.match(serviceModesMigration,/not in \('presencial','online','domiciliar'\)/)
  assert.match(publicProfile,/serviceModeLabel/)
})

test('Premium aceita três especialidades e o diretório preserva todas',()=>{
  assert.match(plans,/plan === 'free' \? 1 : 3/)
  assert.match(migration,/array_agg\(distinct s\.name\)/)
  assert.match(landing,/Até 3 especialidades/)
})

test('cartão demonstrativo mantém texto fora da sobreposição da capa',()=>{
  assert.match(css,/somente o avatar sobre a capa/)
  assert.match(css,/\.premium-profile-demo \.demo-person\{align-items:flex-start;margin-top:14px\}/)
  assert.match(css,/\.demo-person>div:last-child\{padding-top:0/)
})
