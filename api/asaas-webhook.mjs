import {handleAsaasWebhook} from './_lib/asaas-webhook-handler.mjs'

export default function handler(req,res){
  const productionRoute=req.query?.asaasEnvironment==='production'
  return handleAsaasWebhook(req,res,productionRoute
    ?{environment:'production',tokenVariable:'ASAAS_PRODUCTION_WEBHOOK_TOKEN'}
    :{environment:'sandbox',tokenVariable:'ASAAS_WEBHOOK_TOKEN'})
}
