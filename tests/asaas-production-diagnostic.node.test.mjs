import test from 'node:test'
import assert from 'node:assert/strict'
import {createProductionDiagnosticHandler} from '../api/_lib/asaas-production-diagnostic-handler.mjs'
import {readFile} from 'node:fs/promises'

const checkoutSource=await readFile(new URL('../api/asaas-checkout.mjs',import.meta.url),'utf8')
const vercelConfig=await readFile(new URL('../vercel.json',import.meta.url),'utf8')

function response(){
  return {statusCode:200,headers:{},setHeader(name,value){this.headers[name]=value},end(body){this.payload=JSON.parse(body);return this}}
}

test('diagnóstico exige administrador e não consulta o Asaas sem autorização',async()=>{
  process.env.ASAAS_PRODUCTION_DIAGNOSTIC_ENABLED='true'
  let calls=0
  const handler=createProductionDiagnosticHandler({authorize:async()=>{throw Object.assign(new Error('Acesso administrativo necessário.'),{status:403})},request:async()=>{calls++}})
  const res=response();await handler({method:'GET',headers:{}},res)
  assert.equal(res.statusCode,403);assert.equal(calls,0)
})

test('diagnóstico usa somente GET read-only em Production e sanitiza a resposta',async()=>{
  process.env.ASAAS_PRODUCTION_DIAGNOSTIC_ENABLED='true'
  const calls=[]
  const handler=createProductionDiagnosticHandler({authorize:async()=>({}),request:async(path,options,environment,control)=>{
    calls.push({path,options,environment,control})
    if(path.startsWith('/pix/'))return {data:[{id:'pix-secret-id',key:'sensitive',status:'ACTIVE'}]}
    return {data:[{id:'webhook-secret-id',url:'https://www.materplace.com.br/api/asaas-production-webhook',enabled:true,interrupted:false,apiVersion:3,sendType:'SEQUENTIALLY',events:['CHECKOUT_PAID']}]}
  }})
  const old=process.env.ASAAS_PRODUCTION_CHARGES_ENABLED
  process.env.ASAAS_PRODUCTION_CHARGES_ENABLED='false'
  try{
    const res=response();await handler({method:'GET',headers:{}},res)
    assert.equal(res.statusCode,200)
    assert.equal(res.payload.productionChargesEnabled,false)
    assert.equal(res.payload.pix.activeKeyExists,true)
    assert.equal(res.payload.webhook.configurations[0].endpointMatches,true)
    assert.deepEqual(calls.map(call=>[call.options.method,call.environment,call.control.readOnly]),[['GET','production',true],['GET','production',true]])
    const serialized=JSON.stringify(res.payload)
    assert.doesNotMatch(serialized,/pix-secret-id|webhook-secret-id|sensitive/)
    assert.equal(res.headers['Cache-Control'],'no-store, max-age=0')
  }finally{
    if(old===undefined)delete process.env.ASAAS_PRODUCTION_CHARGES_ENABLED
    else process.env.ASAAS_PRODUCTION_CHARGES_ENABLED=old
  }
})

test('diagnóstico rejeita métodos de escrita',async()=>{
  process.env.ASAAS_PRODUCTION_DIAGNOSTIC_ENABLED='true'
  let authorized=false
  const handler=createProductionDiagnosticHandler({authorize:async()=>{authorized=true},request:async()=>({})})
  const res=response();await handler({method:'POST',headers:{}},res)
  assert.equal(res.statusCode,405);assert.equal(authorized,false)
})

test('diagnóstico permanece invisível quando a trava temporária está desativada',async()=>{
  delete process.env.ASAAS_PRODUCTION_DIAGNOSTIC_ENABLED
  let authorized=false
  const handler=createProductionDiagnosticHandler({authorize:async()=>{authorized=true},request:async()=>({})})
  const res=response();await handler({method:'GET',headers:{}},res)
  assert.equal(res.statusCode,404);assert.equal(authorized,false)
})

test('diagnóstico reutiliza função existente para respeitar o limite Hobby',()=>{
  assert.match(checkoutSource,/asaasMode==='production-diagnostic'/)
  assert.match(vercelConfig,/"\/api\/asaas-production-diagnostic"[^\n]+asaasMode=production-diagnostic/)
})
