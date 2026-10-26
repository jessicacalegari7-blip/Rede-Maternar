import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PREMIUM_PRODUCT,asaasBaseUrl,asaasRequest,eventFields,hasActivePixKey,hasPendingPixKey,normalizeTaxId,processableEventType,productionPilotEnvironment,reconcilePaidEvent,safeEqual,validPhone,validTaxId} from '../api/_lib/asaas.mjs'
import {handleAsaasWebhook} from '../api/_lib/asaas-webhook-handler.mjs'

function responseCapture(){
  return {statusCode:0,headers:{},body:null,setHeader(name,value){this.headers[name]=value},end(value){this.body=JSON.parse(value)}}
}

test('preço permanece exclusivamente no backend',()=>assert.deepEqual(PREMIUM_PRODUCT,{code:'premium_annual',name:'Perfil Premium MaterPlace',amountCents:5999,validityMonths:12}))
test('Sandbox é o ambiente padrão',()=>{delete process.env.ASAAS_ENVIRONMENT;assert.match(asaasBaseUrl(),/api-sandbox/);process.env.ASAAS_ENVIRONMENT='production';assert.equal(asaasBaseUrl(),'https://api.asaas.com/v3');delete process.env.ASAAS_ENVIRONMENT})
test('normaliza e valida dados mínimos',()=>{assert.equal(normalizeTaxId('529.982.247-25'),'52998224725');assert.equal(validTaxId('529.982.247-25'),true);assert.equal(validTaxId('11.222.333/0001-81'),true);assert.equal(validTaxId('354.786.238-81'),true);assert.equal(validTaxId('354.786.238-82'),false);assert.equal(validTaxId('111.111.111-11'),false);assert.equal(validPhone('(11) 99999-9999'),true)})
test('só considera Pix pronto quando existe chave ACTIVE',()=>{assert.equal(hasActivePixKey({data:[{status:'AWAITING_ACTIVATION'}]}),false);assert.equal(hasPendingPixKey({data:[{status:'AWAITING_ACTIVATION'}]}),true);assert.equal(hasActivePixKey({data:[{status:'ACTIVE'}]}),true)})
test('extrai correlação e valor do webhook',()=>assert.deepEqual(eventFields({id:'evt_1',event:'CHECKOUT_PAID',checkout:{id:'chk_1',externalReference:'order-1',value:59.99},payment:{id:'pay_1'}}),{eventId:'evt_1',eventType:'CHECKOUT_PAID',checkoutId:'chk_1',paymentId:'pay_1',externalReference:'order-1',amountCents:5999,refundedAmountCents:null}))
test('calcula o total do checkout pela lista de itens enviada pelo Asaas',()=>assert.equal(eventFields({id:'evt_2',event:'CHECKOUT_PAID',checkout:{items:[{quantity:1,value:59.99}]}}).amountCents,5999))
test('compara token de webhook com segurança',()=>{assert.equal(safeEqual('token-seguro','token-seguro'),true);assert.equal(safeEqual('token-seguro','token'),false)})
test('preserva estados financeiros distintos',()=>{assert.equal(processableEventType('PAYMENT_CHARGEBACK_DISPUTE'),'PAYMENT_CHARGEBACK_DISPUTE');assert.equal(processableEventType('PAYMENT_PARTIALLY_REFUNDED'),'PAYMENT_PARTIALLY_REFUNDED')})
test('piloto de produção exige todas as travas e comprador autorizado',()=>{
  const old={...process.env};delete process.env.ASAAS_PRODUCTION_CHARGES_ENABLED;delete process.env.ASAAS_PRODUCTION_PILOT_ENABLED;delete process.env.ASAAS_PRODUCTION_PILOT_EMAIL;delete process.env.ASAAS_PRODUCTION_PILOT_TAX_ID_SHA256
  try{assert.equal(productionPilotEnvironment({email:'pilot@example.com',taxId:'52998224725'}),'sandbox')}
  finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
})
test('reconciliação autoritativa aceita somente cobrança confirmada correspondente',async()=>{
  process.env.ASAAS_API_KEY='sandbox_test';const originalFetch=global.fetch
  global.fetch=async()=>new Response(JSON.stringify({id:'pay_1',status:'RECEIVED',value:59.99,externalReference:'order-1',billingType:'PIX'}),{status:200,headers:{'content-type':'application/json'}})
  try{const result=await reconcilePaidEvent({paymentId:'pay_1',externalReference:'order-1'},'sandbox');assert.equal(result.amountCents,5999);assert.equal(result.status,'RECEIVED')}
  finally{global.fetch=originalFetch;delete process.env.ASAAS_API_KEY}
})
test('reconciliação rejeita valor divergente',async()=>{
  process.env.ASAAS_API_KEY='sandbox_test';const originalFetch=global.fetch
  global.fetch=async()=>new Response(JSON.stringify({id:'pay_1',status:'RECEIVED',value:60,externalReference:'order-1'}),{status:200,headers:{'content-type':'application/json'}})
  try{await assert.rejects(reconcilePaidEvent({paymentId:'pay_1',externalReference:'order-1'},'sandbox'),/Valor financeiro divergente/)}finally{global.fetch=originalFetch;delete process.env.ASAAS_API_KEY}
})
test('simula 50 checkouts concorrentes sem cobrança real',async()=>{process.env.ASAAS_API_KEY='sandbox_test';const originalFetch=global.fetch;let calls=0;global.fetch=async(_url,request)=>{calls++;const body=JSON.parse(request.body);assert.match(body.externalReference,/^order-/);return new Response(JSON.stringify({id:`checkout-${calls}`}),{status:200,headers:{'content-type':'application/json'}})};try{const rows=await Promise.all(Array.from({length:50},(_,index)=>asaasRequest('/checkouts',{method:'POST',body:JSON.stringify({externalReference:`order-${index}`})})));assert.equal(rows.length,50);assert.equal(calls,50)}finally{global.fetch=originalFetch;delete process.env.ASAAS_API_KEY}})
test('erro da API nunca confirma pagamento',async()=>{process.env.ASAAS_API_KEY='sandbox_test';const originalFetch=global.fetch;global.fetch=async()=>new Response(JSON.stringify({errors:[{description:'payload inválido'}]}),{status:400,headers:{'content-type':'application/json'}});try{await assert.rejects(asaasRequest('/checkouts',{method:'POST',body:'{}'}),/payload inválido/)}finally{global.fetch=originalFetch;delete process.env.ASAAS_API_KEY}})
test('chave de produção sozinha não habilita operações financeiras reais',async()=>{
  process.env.ASAAS_PRODUCTION_API_KEY='production_test';delete process.env.ASAAS_PRODUCTION_CHARGES_ENABLED
  try{await assert.rejects(asaasRequest('/checkouts',{method:'POST',body:'{}'},'production'),/ainda não foram autorizadas/)}
  finally{delete process.env.ASAAS_PRODUCTION_API_KEY}
})
test('endpoint de produção permanece fechado sem token próprio',async()=>{
  delete process.env.ASAAS_PRODUCTION_WEBHOOK_TOKEN
  const res=responseCapture()
  await handleAsaasWebhook({method:'POST',headers:{},body:{}},res,{environment:'production',tokenVariable:'ASAAS_PRODUCTION_WEBHOOK_TOKEN'})
  assert.equal(res.statusCode,503);assert.equal(res.body.error,'Webhook ainda não configurado.')
})
test('endpoint de produção rejeita token incorreto antes de acessar o banco',async()=>{
  process.env.ASAAS_PRODUCTION_WEBHOOK_TOKEN='token-production-seguro'
  const res=responseCapture()
  try{await handleAsaasWebhook({method:'POST',headers:{'asaas-access-token':'incorreto'},body:{}},res,{environment:'production',tokenVariable:'ASAAS_PRODUCTION_WEBHOOK_TOKEN'});assert.equal(res.statusCode,401)}
  finally{delete process.env.ASAAS_PRODUCTION_WEBHOOK_TOKEN}
})
test('pagamento aprovado usa somente o novo convite seguro',async()=>{
  const webhook=await readFile(new URL('../api/_lib/asaas-webhook-handler.mjs',import.meta.url),'utf8')
  const adminRetry=await readFile(new URL('../api/_lib/admin-asaas-handler.mjs',import.meta.url),'utf8')
  const worker=await readFile(new URL('../api/asaas-worker.mjs',import.meta.url),'utf8')
  assert.doesNotMatch(webhook,/deliverPremiumAccessInvite/)
  assert.match(worker,/deliverPremiumAccessInvite/)
  assert.doesNotMatch(webhook,/deliverPremiumActivationEmail/)
  assert.doesNotMatch(adminRetry,/deliverPremiumAccessInvite/)
  assert.match(adminRetry,/reconcilePaidEvent/)
})
test('webhooks usam tokens e ambientes independentes sem confiar no payload',async()=>{
  const sandbox=await readFile(new URL('../api/asaas-webhook.mjs',import.meta.url),'utf8')
  const shared=await readFile(new URL('../api/_lib/asaas-webhook-handler.mjs',import.meta.url),'utf8')
  const vercel=await readFile(new URL('../vercel.json',import.meta.url),'utf8')
  assert.match(sandbox,/environment:'sandbox'.*ASAAS_WEBHOOK_TOKEN/s)
  assert.match(sandbox,/environment:'production'.*ASAAS_PRODUCTION_WEBHOOK_TOKEN/s)
  assert.match(vercel,/\/api\/asaas-production-webhook.*asaasEnvironment=production/s)
  assert.match(shared,/target_asaas_environment:environment/)
  assert.match(shared,/target_asaas_environment:environment/)
})
test('migration isola pedidos, eventos e idempotência por ambiente',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261022120000_asaas_environment_isolation.sql',import.meta.url),'utf8')
  assert.match(migration,/on conflict\(asaas_environment,id\) do nothing/)
  assert.match(migration,/premium_orders_environment_checkout_uidx/)
  assert.match(migration,/where asaas_environment=target_asaas_environment and asaas_checkout_id=target_checkout_id/)
  assert.match(migration,/PAYMENT_REFUNDED.*PAYMENT_PARTIALLY_REFUNDED.*PAYMENT_CHARGEBACK_REQUESTED.*PAYMENT_CHARGEBACK_DISPUTE/s)
})
test('migration ignora somente eventos não financeiros de checkout substituído',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261019150000_ignore_superseded_asaas_checkouts.sql',import.meta.url),'utf8')
  assert.match(migration,/superseded_checkout/)
  assert.match(migration,/CHECKOUT_CANCELED','CHECKOUT_EXPIRED/)
  assert.match(migration,/checkout_mismatch/)
})
test('recuperação de convite exige dados correlacionados e mantém resposta neutra',async()=>{
  const checkout=await readFile(new URL('../api/asaas-checkout.mjs',import.meta.url),'utf8')
  assert.match(checkout,/recover-invite/)
  assert.match(checkout,/customer_email',email.*customer_phone',phone.*tax_id_last4',taxId\.slice\(-4\)/s)
  assert.match(checkout,/Se a contratação estiver confirmada e o convite ainda for necessário/)
})
test('hardening cria reserva atômica, índices por ambiente, outbox e estados financeiros',async()=>{
  const migration=await readFile(new URL('../supabase/migrations/20261023120000_asaas_financial_hardening.sql',import.meta.url),'utf8')
  assert.match(migration,/pg_advisory_xact_lock/)
  assert.match(migration,/checkout_reconciliation_required/)
  assert.match(migration,/premium_orders\(asaas_environment,lower\(customer_email\),product_code\)/)
  assert.match(migration,/premium_email_outbox/)
  assert.match(migration,/PAYMENT_PARTIALLY_REFUNDED.*partially_refunded/s)
  assert.match(migration,/PAYMENT_CHARGEBACK_DISPUTE.*chargeback_dispute/s)
})
test('webhook não depende do envio imediato pelo Brevo',async()=>{
  const webhook=await readFile(new URL('../api/_lib/asaas-webhook-handler.mjs',import.meta.url),'utf8')
  assert.doesNotMatch(webhook,/deliverPremiumAccessInvite/)
  assert.match(webhook,/record_asaas_webhook_event/)
  assert.match(webhook,/reconciliation_pending/)
})
