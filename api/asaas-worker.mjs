import {adminClient} from './_lib/supabase-admin.mjs'
import {json} from './_lib/http.mjs'
import {eventFields,reconcilePaidEvent,safeEqual,validateCheckoutPaidPayload} from './_lib/asaas.mjs'
import {deliverPremiumAccessInvite} from './_lib/premium-email.mjs'

function authorized(req){
  const expected=process.env.CRON_SECRET?.trim()
  return Boolean(expected)&&safeEqual(String(req.headers.authorization||''),`Bearer ${expected}`)
}

export default async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'Método não permitido.'})
  if(!authorized(req))return json(res,401,{error:'Não autorizado.'})
  const db=adminClient(),summary={eventsProcessed:0,eventsPending:0,emailsSent:0,emailsFailed:0}
  try{
    const {data:events,error:eventError}=await db.from('asaas_webhook_events').select('id,asaas_environment,payload').in('processing_status',['received','error']).lt('attempts',8).order('received_at',{ascending:true}).limit(10)
    if(eventError)throw eventError
    for(const event of events||[]){
      try{
        const fields=eventFields(event.payload),authoritative=fields.eventType==='CHECKOUT_PAID'?(validateCheckoutPaidPayload(event.payload),{...fields,...await reconcilePaidEvent(fields,event.asaas_environment)}):fields
        const {data:result,error}=await db.rpc('process_asaas_webhook_event',{target_asaas_environment:event.asaas_environment,target_event_id:fields.eventId,target_event_type:fields.eventType,target_checkout_id:authoritative.checkoutId,target_payment_id:authoritative.paymentId,target_external_reference:authoritative.externalReference,target_amount_cents:authoritative.amountCents,target_payload:event.payload})
        if(error||!result?.ok)throw error||new Error(result?.error_code||'processing_failed')
        summary.eventsProcessed++
      }catch(error){summary.eventsPending++;console.error('asaas_event_worker_pending',{environment:event.asaas_environment,eventIdSuffix:event.id.slice(-12),code:error?.code||null})}
    }
    const {data:outbox,error:claimError}=await db.rpc('claim_premium_email_outbox',{target_limit:10})
    if(claimError)throw claimError
    for(const job of outbox||[]){
      try{
        const status=await deliverPremiumAccessInvite(db,{orderId:job.order_id})
        if(!['sent','already_sent','used'].includes(status))throw new Error(`invite_${status}`)
        await db.rpc('finish_premium_email_outbox',{target_id:job.id,target_status:'sent',target_last_error:null})
        summary.emailsSent++
      }catch(error){
        await db.rpc('finish_premium_email_outbox',{target_id:job.id,target_status:'failed',target_last_error:String(error?.message||'delivery_failed').slice(0,300)})
        summary.emailsFailed++
      }
    }
    return json(res,200,{ok:true,...summary})
  }catch(error){console.error('asaas_worker_failed',{code:error?.code||null});return json(res,500,{error:'Falha temporária no processamento.'})}
}
