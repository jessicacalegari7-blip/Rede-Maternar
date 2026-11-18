import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {marketingUserData,queueMarketingEvent,sendMetaConversion,processMarketingOutbox} from '../api/_lib/meta-marketing.mjs'

const migration=fs.readFileSync(new URL('../supabase/migrations/20261117170000_marketing_measurement_foundation.sql',import.meta.url),'utf8')
const checkout=fs.readFileSync(new URL('../api/asaas-checkout.mjs',import.meta.url),'utf8')
const webhook=fs.readFileSync(new URL('../api/_lib/asaas-webhook-handler.mjs',import.meta.url),'utf8')
const browser=fs.readFileSync(new URL('../src/lib/marketing.ts',import.meta.url),'utf8')
const marketingApi=fs.readFileSync(new URL('../api/_lib/marketing-event-handler.mjs',import.meta.url),'utf8')
const vercelConfig=fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8')

test('identificadores pessoais enviados à CAPI são normalizados e hasheados',()=>{
  const data=marketingUserData({email:' Pessoa@Example.com ',phone:'(11) 99999-0000',fbp:'fb.1.1.abc'})
  assert.match(data.em[0],/^[a-f0-9]{64}$/);assert.match(data.ph[0],/^[a-f0-9]{64}$/);assert.equal(data.fbp,'fb.1.1.abc')
  assert.doesNotMatch(JSON.stringify(data),/Pessoa@|99999-0000/)
})

test('CAPI fica inerte sem flag e nunca exige token no modo desativado',async()=>{
  let called=false
  const result=await sendMetaConversion({event_name:'PageView'},{env:{META_CAPI_ENABLED:'false'},fetchImpl:async()=>{called=true}})
  assert.equal(result.status,'disabled');assert.equal(called,false)
})

test('coleta permanece inerte até habilitação explícita no cliente e servidor',()=>{
  assert.match(browser,/VITE_META_TRACKING_ENABLED/)
  assert.match(marketingApi,/META_MARKETING_COLLECTION_ENABLED/)
  assert.match(vercelConfig,/marketing-event[^\n]+asaasMode=marketing-event/)
})

test('CAPI aceita exatamente um evento confirmado pela Meta',async()=>{
  const result=await sendMetaConversion(
    {event_name:'Purchase',event_id:'purchase:1'},
    {env:{META_CAPI_ENABLED:'true',META_DATASET_ID:'dataset',META_CAPI_ACCESS_TOKEN:'secret'},fetchImpl:async(url,options)=>{
      assert.match(url,/graph\.facebook\.com/);assert.doesNotMatch(url,/secret/)
      assert.equal(options.headers.Authorization,'Bearer secret');assert.equal(options.method,'POST')
      return{ok:true,json:async()=>({events_received:1,fbtrace_id:'trace'})}
    }}
  )
  assert.equal(result.status,'sent')
})

test('fila não é consultada quando CAPI está desativada',async()=>{
  let calls=0;const result=await processMarketingOutbox({rpc:async()=>{calls++;return{data:[]}}},{env:{META_CAPI_ENABLED:'false'}})
  assert.equal(calls,0);assert.equal(result.marketingSent,0)
})

test('eventos sem consentimento não entram na fila',async()=>{
  let calls=0;const result=await queueMarketingEvent({rpc:async()=>{calls++;return{data:true}}},{eventId:'pageview:123456789',eventName:'PageView',consent:false})
  assert.equal(calls,0);assert.equal(result.queued,false)
})

test('Purchase é deduplicado pelo token público e só nasce do webhook pago',()=>{
  assert.match(webhook,/eventType==='CHECKOUT_PAID'/);assert.match(webhook,/`purchase:\$\{order\.public_token\}`/)
  assert.match(migration,/event_id text not null unique/);assert.match(migration,/on conflict\(event_id\) do nothing/)
})

test('Lead e InitiateCheckout são correlacionados ao pedido no backend',()=>{
  assert.match(checkout,/`lead:\$\{order\.order_id\}`/);assert.match(checkout,/`checkout:\$\{order\.order_id\}`/)
  assert.match(checkout,/marketing_consent/)
})

test('CompleteRegistration ocorre somente após resgate válido do convite pago',()=>{
  assert.match(checkout,/redeem_premium_access_invite/)
  assert.match(checkout,/eventName:'CompleteRegistration'/)
  assert.match(checkout,/`registration:\$\{order\.public_token\}`/)
})

test('Pixel só inicializa depois do consentimento e preserva event_id',()=>{
  assert.match(browser,/localStorage\.getItem\(consentKey\)==='accepted'/)
  assert.match(browser,/eventID:eventId/)
  assert.match(browser,/fbclid/);assert.match(browser,/fbp/);assert.match(browser,/fbc/)
})

test('cupons e recuperação são criados desativados e sem alterar preço histórico',()=>{
  assert.match(migration,/enabled boolean not null default false/)
  assert.match(migration,/marketing_recovery_queue/)
  assert.match(migration,/list_amount_cents=amount_cents/)
})
