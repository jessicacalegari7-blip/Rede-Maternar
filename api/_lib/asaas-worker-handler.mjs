import {adminClient} from './supabase-admin.mjs'
import {json} from './http.mjs'
import {eventFields,reconcilePaidEvent,safeEqual,validateCheckoutPaidPayload} from './asaas.mjs'
import {deliverPremiumAccessInvite} from './premium-email.mjs'

export function workerAuthorized(req,env=process.env){
  const authorization=String(req.headers.authorization||'')
  const candidates=[env.ASAAS_WORKER_CRON_SECRET,env.CRON_SECRET].map(value=>value?.trim()).filter(Boolean)
  return candidates.some(secret=>safeEqual(authorization,`Bearer ${secret}`))
}

export async function processPremiumEmailJobs(db,jobs,{deliver=deliverPremiumAccessInvite}={}){
  const summary={emailsSent:0,emailsFailed:0,emailsUncertain:0,staleFinishes:0}
  for(const job of jobs||[]){
    try{
      const status=await deliver(db,{orderId:job.order_id,idempotencyKey:job.delivery_key,traceId:job.id})
      if(status==='delivery_uncertain'){
        const {data:finished}=await db.rpc('finish_premium_email_outbox',{target_id:job.id,target_lease_token:job.lease_token,target_status:'uncertain',target_last_error:'provider_acceptance_unconfirmed',target_provider_id:null})
        if(finished===false)summary.staleFinishes++
        else summary.emailsUncertain++
        continue
      }
      if(!['sent','already_sent','used'].includes(status))throw new Error(`invite_${status}`)
      const {data:finished,error}=await db.rpc('finish_premium_email_outbox',{target_id:job.id,target_lease_token:job.lease_token,target_status:'sent',target_last_error:null,target_provider_id:null})
      if(error)throw error
      if(finished===false){summary.staleFinishes++;continue}
      summary.emailsSent++
    }catch(error){
      const {data:finished}=await db.rpc('finish_premium_email_outbox',{target_id:job.id,target_lease_token:job.lease_token,target_status:'failed',target_last_error:String(error?.message||'delivery_failed').slice(0,300),target_provider_id:null})
      if(finished===false)summary.staleFinishes++
      else summary.emailsFailed++
    }
  }
  return summary
}

export function createWorkerHandler({getDb=adminClient,deliver=deliverPremiumAccessInvite,reconcile=reconcilePaidEvent}={}){
  return async function workerHandler(req,res){
    if(req.method!=='GET')return json(res,405,{error:'Método não permitido.'})
    if(!workerAuthorized(req))return json(res,401,{error:'Não autorizado.'})
    const db=getDb(),summary={eventsProcessed:0,eventsPending:0,emailsSent:0,emailsFailed:0,emailsUncertain:0,staleFinishes:0}
    try{
      const {data:events,error:eventError}=await db.from('asaas_webhook_events').select('id,asaas_environment,payload').in('processing_status',['received','error']).lt('attempts',8).order('received_at',{ascending:true}).limit(10)
      if(eventError)throw eventError
      for(const event of events||[]){
        try{
          const fields=eventFields(event.payload),authoritative=fields.eventType==='CHECKOUT_PAID'?(validateCheckoutPaidPayload(event.payload),{...fields,...await reconcile(fields,event.asaas_environment)}):fields
          const {data:result,error}=await db.rpc('process_asaas_webhook_event',{target_asaas_environment:event.asaas_environment,target_event_id:fields.eventId,target_event_type:fields.eventType,target_checkout_id:authoritative.checkoutId,target_payment_id:authoritative.paymentId,target_external_reference:authoritative.externalReference,target_amount_cents:authoritative.amountCents,target_payload:event.payload})
          if(error||!result?.ok)throw error||new Error(result?.error_code||'processing_failed')
          summary.eventsProcessed++
        }catch(error){summary.eventsPending++;console.error('asaas_event_worker_pending',{environment:event.asaas_environment,eventIdSuffix:event.id.slice(-12),code:error?.code||null})}
      }
      const {data:outbox,error:claimError}=await db.rpc('claim_premium_email_outbox',{target_limit:10})
      if(claimError)throw claimError
      Object.assign(summary,await processPremiumEmailJobs(db,outbox,{deliver}))
      return json(res,200,{ok:true,...summary})
    }catch(error){console.error('asaas_worker_failed',{code:error?.code||null});return json(res,500,{error:'Falha temporária no processamento.'})}
  }
}

export default createWorkerHandler()
