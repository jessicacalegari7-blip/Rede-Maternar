import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PREMIUM_PRODUCT,asaasBaseUrl,asaasRequest,eventFields,hasActivePixKey,hasPendingPixKey,normalizeTaxId,processableEventType,safeEqual,validPhone,validTaxId} from '../api/_lib/asaas.mjs'

test('preço permanece exclusivamente no backend',()=>assert.deepEqual(PREMIUM_PRODUCT,{code:'premium_annual',name:'Perfil Premium MaterPlace',amountCents:5999,validityMonths:12}))
test('Sandbox é o ambiente padrão',()=>{delete process.env.ASAAS_ENVIRONMENT;assert.match(asaasBaseUrl(),/api-sandbox/);process.env.ASAAS_ENVIRONMENT='production';assert.equal(asaasBaseUrl(),'https://api.asaas.com/v3');delete process.env.ASAAS_ENVIRONMENT})
test('normaliza e valida dados mínimos',()=>{assert.equal(normalizeTaxId('529.982.247-25'),'52998224725');assert.equal(validTaxId('529.982.247-25'),true);assert.equal(validTaxId('11.222.333/0001-81'),true);assert.equal(validTaxId('354.786.238-81'),true);assert.equal(validTaxId('354.786.238-82'),false);assert.equal(validTaxId('111.111.111-11'),false);assert.equal(validPhone('(11) 99999-9999'),true)})
test('só considera Pix pronto quando existe chave ACTIVE',()=>{assert.equal(hasActivePixKey({data:[{status:'AWAITING_ACTIVATION'}]}),false);assert.equal(hasPendingPixKey({data:[{status:'AWAITING_ACTIVATION'}]}),true);assert.equal(hasActivePixKey({data:[{status:'ACTIVE'}]}),true)})
test('extrai correlação e valor do webhook',()=>assert.deepEqual(eventFields({id:'evt_1',event:'CHECKOUT_PAID',checkout:{id:'chk_1',externalReference:'order-1',value:59.99},payment:{id:'pay_1'}}),{eventId:'evt_1',eventType:'CHECKOUT_PAID',checkoutId:'chk_1',paymentId:'pay_1',externalReference:'order-1',amountCents:5999}))
test('calcula o total do checkout pela lista de itens enviada pelo Asaas',()=>assert.equal(eventFields({id:'evt_2',event:'CHECKOUT_PAID',checkout:{items:[{quantity:1,value:59.99}]}}).amountCents,5999))
test('compara token de webhook com segurança',()=>{assert.equal(safeEqual('token-seguro','token-seguro'),true);assert.equal(safeEqual('token-seguro','token'),false)})
test('normaliza disputa de chargeback preservando o tratamento financeiro seguro',()=>{assert.equal(processableEventType('PAYMENT_CHARGEBACK_DISPUTE'),'PAYMENT_CHARGEBACK_REQUESTED');assert.equal(processableEventType('CHECKOUT_PAID'),'CHECKOUT_PAID')})
test('simula 50 checkouts concorrentes sem cobrança real',async()=>{process.env.ASAAS_API_KEY='sandbox_test';const originalFetch=global.fetch;let calls=0;global.fetch=async(_url,request)=>{calls++;const body=JSON.parse(request.body);assert.match(body.externalReference,/^order-/);return new Response(JSON.stringify({id:`checkout-${calls}`}),{status:200,headers:{'content-type':'application/json'}})};try{const rows=await Promise.all(Array.from({length:50},(_,index)=>asaasRequest('/checkouts',{method:'POST',body:JSON.stringify({externalReference:`order-${index}`})})));assert.equal(rows.length,50);assert.equal(calls,50)}finally{global.fetch=originalFetch;delete process.env.ASAAS_API_KEY}})
test('erro da API nunca confirma pagamento',async()=>{process.env.ASAAS_API_KEY='sandbox_test';const originalFetch=global.fetch;global.fetch=async()=>new Response(JSON.stringify({errors:[{description:'payload inválido'}]}),{status:400,headers:{'content-type':'application/json'}});try{await assert.rejects(asaasRequest('/checkouts',{method:'POST',body:'{}'}),/payload inválido/)}finally{global.fetch=originalFetch;delete process.env.ASAAS_API_KEY}})
test('pagamento aprovado usa somente o novo convite seguro',async()=>{
  const webhook=await readFile(new URL('../api/asaas-webhook.mjs',import.meta.url),'utf8')
  const adminRetry=await readFile(new URL('../api/_lib/admin-asaas-handler.mjs',import.meta.url),'utf8')
  assert.match(webhook,/deliverPremiumAccessInvite/)
  assert.doesNotMatch(webhook,/deliverPremiumActivationEmail/)
  assert.match(adminRetry,/deliverPremiumAccessInvite/)
})
test('migration ignora somente eventos não financeiros de checkout substituído',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261019150000_ignore_superseded_asaas_checkouts.sql',import.meta.url),'utf8')
  assert.match(migration,/superseded_checkout/)
  assert.match(migration,/CHECKOUT_CANCELED','CHECKOUT_EXPIRED/)
  assert.match(migration,/checkout_mismatch/)
})
