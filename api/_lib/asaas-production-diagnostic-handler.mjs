import {asaasRequest} from './asaas.mjs'
import {requirePlatformAdmin} from './supabase-admin.mjs'
import {allowMethods,json} from './http.mjs'

const expectedWebhookUrl='https://www.materplace.com.br/api/asaas-production-webhook'

function webhookSummary(webhook){
  const configuredUrl=String(webhook?.url||'').replace(/\/+$/,'')
  const expectedUrl=expectedWebhookUrl.replace(/\/+$/,'')
  return {
    endpointMatches:configuredUrl===expectedUrl,
    enabled:webhook?.enabled===true,
    interrupted:webhook?.interrupted===true,
    apiVersion:webhook?.apiVersion||null,
    sendType:webhook?.sendType||null,
    events:Array.isArray(webhook?.events)?[...new Set(webhook.events.map(String))].sort():[],
  }
}

export function createProductionDiagnosticHandler({authorize=requirePlatformAdmin,request=asaasRequest}={}){
  return async function productionDiagnostic(req,res){
    res.setHeader?.('Cache-Control','no-store, max-age=0')
    res.setHeader?.('X-Content-Type-Options','nosniff')
    if(!allowMethods(req,res,['GET']))return
    if(process.env.ASAAS_PRODUCTION_DIAGNOSTIC_ENABLED!=='true')return json(res,404,{error:'Não encontrado.'})
    try{
      await authorize(req)
      const [pixPayload,webhookPayload]=await Promise.all([
        request('/pix/addressKeys?limit=100',{method:'GET'},'production',{readOnly:true}),
        request('/webhooks?limit=100',{method:'GET'},'production',{readOnly:true}),
      ])
      const activePixKeys=Array.isArray(pixPayload?.data)
        ?pixPayload.data.filter(key=>key?.status==='ACTIVE').length:0
      const webhooks=Array.isArray(webhookPayload?.data)
        ?webhookPayload.data.map(webhookSummary):[]
      return json(res,200,{
        ok:true,
        environment:'production',
        authenticationAccepted:true,
        productionChargesEnabled:process.env.ASAAS_PRODUCTION_CHARGES_ENABLED==='true',
        pix:{activeKeyExists:activePixKeys>0,activeKeyCount:activePixKeys},
        webhook:{expectedEndpoint:expectedWebhookUrl,configuredCount:webhooks.length,configurations:webhooks},
      })
    }catch(error){
      const status=Number(error?.status)||500
      return json(res,status,{ok:false,error:status===401||status===403?error.message:'Não foi possível concluir o diagnóstico seguro.'})
    }
  }
}

export default createProductionDiagnosticHandler()
