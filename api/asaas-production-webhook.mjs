import {handleAsaasWebhook} from './_lib/asaas-webhook-handler.mjs'

export default function handler(req,res){
  return handleAsaasWebhook(req,res,{environment:'production',tokenVariable:'ASAAS_PRODUCTION_WEBHOOK_TOKEN'})
}
