import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {eventFields,safeEqual} from './_lib/asaas.mjs'
import {deliverPremiumActivationEmail} from './_lib/premium-email.mjs'

export default async function handler(req,res){
  if(!allowMethods(req,res,['POST']))return
  const expected=process.env.ASAAS_WEBHOOK_TOKEN?.trim(),received=req.headers['asaas-access-token']
  if(!expected||!safeEqual(received,expected))return json(res,401,{error:'Webhook não autorizado.'})
  const db=adminClient()
  try{
    const payload=await readJson(req),fields=eventFields(payload)
    if(!fields.eventId||!fields.eventType)return json(res,400,{error:'Evento inválido.'})
    const {data:result,error:rpcError}=await db.rpc('process_asaas_webhook_event',{
      target_event_id:fields.eventId,target_event_type:fields.eventType,target_checkout_id:fields.checkoutId,
      target_payment_id:fields.paymentId,target_external_reference:fields.externalReference,
      target_amount_cents:fields.amountCents,target_payload:payload,
    })
    if(rpcError)throw rpcError
    if(!result?.ok)return json(res,500,{error:'Falha temporária ao processar evento.',code:result?.error_code||'processing_failed'})
    let emailStatus=null,emailTarget=result
    if(fields.eventType==='CHECKOUT_PAID'&&(!emailTarget?.user_id||!emailTarget?.order_id)){
      let query=db.from('premium_orders').select('id,user_id').limit(1)
      query=fields.externalReference?/^[0-9a-f-]{36}$/i.test(fields.externalReference)?query.eq('id',fields.externalReference):query.eq('asaas_checkout_id',fields.checkoutId):query.eq('asaas_checkout_id',fields.checkoutId)
      const {data:order}=await query.maybeSingle()
      if(order)emailTarget={...result,order_id:order.id,user_id:order.user_id}
    }
    if(fields.eventType==='CHECKOUT_PAID')emailStatus=await deliverPremiumActivationEmail(db,emailTarget).catch(()=>'failed_to_record')
    return json(res,200,{ok:true,status:result?.status,duplicate:Boolean(result?.duplicate),ignored:Boolean(result?.ignored),emailStatus})
  }catch{
    return json(res,500,{error:'Falha temporária ao processar evento.'})
  }
}
