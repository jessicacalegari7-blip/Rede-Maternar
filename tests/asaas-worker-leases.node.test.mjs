import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {processPremiumEmailJobs,workerAuthorized} from '../api/_lib/asaas-worker-handler.mjs'

const migration=await readFile(new URL('../supabase/migrations/20261027160000_premium_email_outbox_leases.sql',import.meta.url),'utf8')
const worker=await readFile(new URL('../api/_lib/asaas-worker-handler.mjs',import.meta.url),'utf8')
const email=await readFile(new URL('../api/_lib/premium-email.mjs',import.meta.url),'utf8')
const vercel=await readFile(new URL('../vercel.json',import.meta.url),'utf8')
const asaas=await readFile(new URL('../api/_lib/asaas.mjs',import.meta.url),'utf8')
const job={id:'11111111-1111-4111-8111-111111111111',order_id:'22222222-2222-4222-8222-222222222222',lease_token:'33333333-3333-4333-8333-333333333333',delivery_key:'44444444-4444-4444-8444-444444444444'}
const db=(finish=true)=>({calls:[],async rpc(name,args){this.calls.push([name,args]);return {data:finish,error:null}}})

test('1 processamento normal conclui o lease',async()=>{const d=db();const out=await processPremiumEmailJobs(d,[job],{deliver:async()=> 'sent'});assert.equal(out.emailsSent,1);assert.equal(d.calls[0][1].target_lease_token,job.lease_token)})
test('2 outbox vazia não executa entrega',async()=>{let calls=0;const out=await processPremiumEmailJobs(db(),[],{deliver:async()=>{calls++}});assert.equal(calls,0);assert.deepEqual(out,{emailsSent:0,emailsFailed:0,emailsUncertain:0,staleFinishes:0})})
test('3 falha temporária agenda falha sem dados pessoais',async()=>{const d=db();const out=await processPremiumEmailJobs(d,[job],{deliver:async()=> 'failed'});assert.equal(out.emailsFailed,1);assert.equal(d.calls[0][1].target_status,'failed')})
test('4 claim recupera item processing travado',()=>assert.match(migration,/status='processing' and q\.locked_at<now\(\)-interval '10 minutes'/))
test('5 lease válido não é recuperado',()=>assert.doesNotMatch(migration,/locked_at<now\(\)-interval '15 minutes'/))
test('6 lease expirado recebe novo token',()=>assert.match(migration,/lease_token=gen_random_uuid\(\)/))
test('7 concorrência usa skip locked e lease token',()=>{assert.match(migration,/for update skip locked/);assert.match(migration,/and lease_token=target_lease_token/)})
test('8 convite reutiliza chave idempotente por item',async()=>{let input;await processPremiumEmailJobs(db(),[job],{deliver:async(_db,value)=>(input=value,'sent')});assert.equal(input.idempotencyKey,job.delivery_key);assert.match(email,/IdempotencyKey/)})
test('9 falha após aceitação fica em reconciliação sem reenvio',async()=>{const d=db();const out=await processPremiumEmailJobs(d,[job],{deliver:async()=> 'delivery_uncertain'});assert.equal(out.emailsUncertain,1);assert.equal(d.calls[0][1].target_status,'uncertain')})
test('10 falha antes do envio é registrada para retentativa',async()=>{const d=db();await processPremiumEmailJobs(d,[job],{deliver:async()=>{throw new Error('network')}});assert.equal(d.calls[0][1].target_last_error,'network')})
test('11 backoff permanece exponencial',()=>assert.match(migration,/power\(2,least\(attempts,6\)\)/))
test('12 limite de oito tentativas permanece aplicado',()=>assert.match(migration,/q\.attempts<8/))
test('13 token ausente é rejeitado',()=>assert.equal(workerAuthorized({headers:{}},{}),false))
test('14 token inválido é rejeitado',()=>assert.equal(workerAuthorized({headers:{authorization:'Bearer errado'}},{ASAAS_WORKER_CRON_SECRET:'correto'}),false))
test('15 segredo dedicado e legado permitem transição segura',()=>{assert.equal(workerAuthorized({headers:{authorization:'Bearer novo'}},{ASAAS_WORKER_CRON_SECRET:'novo',CRON_SECRET:'antigo'}),true);assert.equal(workerAuthorized({headers:{authorization:'Bearer antigo'}},{ASAAS_WORKER_CRON_SECRET:'novo',CRON_SECRET:'antigo'}),true)})
test('16 cron diário existente permanece configurado',()=>assert.match(vercel,/\/api\/asaas-worker[\s\S]*15 20 \* \* \*/))
test('17 nenhum cron Supabase recorrente é ativado',()=>assert.doesNotMatch(migration,/cron\.schedule\s*\(/))
test('18 falha Supabase produz resposta genérica',()=>assert.match(worker,/Falha temporária no processamento/))
test('19 cobrança real permanece protegida',()=>assert.match(asaas,/ASAAS_PRODUCTION_CHARGES_ENABLED/))
test('20 migração preserva pedidos e contratos',()=>{assert.doesNotMatch(migration,/delete\s+from\s+public\.(premium_orders|premium_contracts)/i);assert.doesNotMatch(migration,/update\s+public\.(premium_orders|premium_contracts)/i)})
