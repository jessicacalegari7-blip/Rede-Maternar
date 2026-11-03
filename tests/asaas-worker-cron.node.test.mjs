import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const cron=await readFile(new URL('../supabase/migrations/20261103120000_prepare_asaas_worker_cron.sql',import.meta.url),'utf8')
const leases=await readFile(new URL('../supabase/migrations/20261027160000_premium_email_outbox_leases.sql',import.meta.url),'utf8')

test('migration prepara cinco minutos sem ativar ao ser aplicada',()=>{
  assert.match(cron,/schedule:='\*\/5 \* \* \* \*'/)
  assert.doesNotMatch(cron,/^\s*select\s+public\.enable_asaas_worker_cron\(\)/im)
})

test('configuração usa nome canônico e impede duplicidade silenciosa',()=>{
  assert.match(cron,/jobname='materplace-asaas-worker-5m'/)
  assert.match(cron,/matching_jobs>1/)
  assert.match(cron,/pg_advisory_xact_lock/)
})

test('autenticação permanece no Vault e endpoint permanece canônico',()=>{
  assert.match(cron,/vault\.secrets where name='asaas_worker_cron_secret'/)
  assert.match(leases,/url:='https:\/\/www\.materplace\.com\.br\/api\/asaas-worker'/)
  assert.match(leases,/vault\.decrypted_secrets where name='asaas_worker_cron_secret'/)
})

test('controles não são executáveis por papéis da API',()=>{
  assert.match(cron,/revoke all on function public\.enable_asaas_worker_cron\(\) from public,anon,authenticated,service_role/)
  assert.match(cron,/revoke all on function public\.disable_asaas_worker_cron\(\) from public,anon,authenticated,service_role/)
})

test('desativação imediata preserva o job e torna active false',()=>{
  assert.match(cron,/cron\.alter_job\(target_job_id,active:=false\)/)
})
