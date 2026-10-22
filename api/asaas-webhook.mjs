import {handleAsaasWebhook} from './_lib/asaas-webhook-handler.mjs'

export default function handler(req,res){
  return handleAsaasWebhook(req,res,{environment:'sandbox',tokenVariable:'ASAAS_WEBHOOK_TOKEN'})
}
