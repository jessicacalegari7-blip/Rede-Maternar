import {adminClient} from './supabase-admin.mjs'
import {allowMethods,json,readJson} from './http.mjs'
import {eventFields,reconcilePaidEvent,safeEqual,validateCheckoutPaidPayload} from './asaas.mjs'

export async function handleAsaasWebhook(req,res,{environment,tokenVariable}){
  if(!allowMethods(req,res,['POST']))return
  if(!['sandbox','production'].includes(environment))return json(res,500,{error:'Ambiente de webhook inválido.'})
  const expected=process.env[tokenVariable]?.trim(),received=req.headers['asaas-access-token']
  if(!expected)return json(res,503,{error:'Webhook ainda não configurado.'})
  if(!safeEqual(received,expected))return json(res,401,{error:'Webhook não autorizado.'})
  const db=adminClient()
  try{
    const payload=await readJson(req),fields=eventFields(payload)
    if(!fields.eventId||!fields.eventType)return json(res,400,{error:'Evento inválido.'})
    const {data:recorded,error:recordError}=await db.rpc('record_asaas_webhook_event',{
      target_asaas_environment:environment,target_event_id:fields.eventId,target_event_type:fields.eventType,
      target_checkout_id:fields.checkoutId,target_payment_id:fields.paymentId,
      target_external_reference:fields.externalReference,target_payload:payload,
    })
    if(recordError)throw recordError
    if(recorded?.duplicate)return json(res,200,{ok:true,duplicate:true,status:recorded.status})
    let authoritative=fields
    if(fields.eventType==='CHECKOUT_PAID'){
      try{validateCheckoutPaidPayload(payload);authoritative={...fields,...await reconcilePaidEvent(fields,environment)}}
      catch(error){
        if(String(error?.code||'').startsWith('invalid_')||['checkout_not_paid','amount_mismatch','reference_mismatch','payment_mismatch'].includes(error?.code))await db.from('asaas_webhook_events').update({processing_status:'error',attempts:8,last_error:'authoritative_validation_failed'}).eq('asaas_environment',environment).eq('id',fields.eventId)
        console.error('asaas_webhook_reconciliation_pending',{environment,eventIdSuffix:fields.eventId.slice(-12),code:error?.code||null})
        return json(res,200,{ok:true,accepted:true,status:'reconciliation_pending'})
      }
    }
    const {data:result,error:rpcError}=await db.rpc('process_asaas_webhook_event',{
      target_asaas_environment:environment,target_event_id:fields.eventId,target_event_type:fields.eventType,
      target_checkout_id:authoritative.checkoutId,target_payment_id:authoritative.paymentId,
      target_external_reference:authoritative.externalReference,target_amount_cents:authoritative.amountCents,target_payload:payload,
    })
    if(rpcError)throw rpcError
    if(!result?.ok){
      console.error('asaas_webhook_accepted_pending',{environment,eventType:fields.eventType,eventIdSuffix:fields.eventId.slice(-12),code:result?.error_code||'processing_failed'})
      return json(res,200,{ok:true,accepted:true,status:'processing_pending'})
    }
    return json(res,200,{ok:true,status:result?.status,duplicate:Boolean(result?.duplicate),ignored:Boolean(result?.ignored),emailQueued:fields.eventType==='CHECKOUT_PAID'})
  }catch(error){
    console.error('asaas_webhook_processing_failed',{environment,code:error?.code||null,message:String(error?.message||'Falha não identificada').slice(0,300)})
    return json(res,500,{error:'Falha temporária ao processar evento.'})
  }
}
