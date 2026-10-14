import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {eventFields,safeEqual} from './_lib/asaas.mjs'

const supported=new Set(['CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','PAYMENT_REFUNDED','PAYMENT_PARTIALLY_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_DELETED'])

export default async function handler(req,res){
  if(!allowMethods(req,res,['POST']))return
  const expected=process.env.ASAAS_WEBHOOK_TOKEN?.trim(),received=req.headers['asaas-access-token']
  if(!expected||!safeEqual(received,expected))return json(res,401,{error:'Webhook não autorizado.'})
  let eventId=''
  const db=adminClient()
  try{
    const payload=await readJson(req),fields=eventFields(payload);eventId=fields.eventId
    if(!fields.eventId||!fields.eventType)return json(res,400,{error:'Evento inválido.'})
    const {data:existing}=await db.from('asaas_webhook_events').select('processing_status,attempts').eq('id',fields.eventId).maybeSingle()
    if(existing?.processing_status==='processed'||existing?.processing_status==='ignored')return json(res,200,{ok:true,duplicate:true})
    if(!existing){
      const {error:insertError}=await db.from('asaas_webhook_events').insert({id:fields.eventId,event_type:fields.eventType,checkout_id:fields.checkoutId,payment_id:fields.paymentId,external_reference:fields.externalReference,payload,processing_status:'received'})
      if(insertError)throw insertError
    }
    await db.from('asaas_webhook_events').update({processing_status:'processing',attempts:(existing?.attempts||0)+1,last_error:null}).eq('id',fields.eventId)
    if(!supported.has(fields.eventType)){
      await db.from('asaas_webhook_events').update({processing_status:'ignored',processed_at:new Date().toISOString()}).eq('id',fields.eventId)
      return json(res,200,{ok:true,ignored:true})
    }
    let orderId=fields.externalReference
    if(!orderId&&fields.checkoutId){const {data}=await db.from('premium_orders').select('id').eq('asaas_checkout_id',fields.checkoutId).maybeSingle();orderId=data?.id}
    if(!orderId&&fields.paymentId){const {data}=await db.from('premium_orders').select('id').eq('asaas_payment_id',fields.paymentId).maybeSingle();orderId=data?.id}
    if(!orderId)throw new Error('Evento sem pedido correspondente.')
    const {data:result,error:rpcError}=await db.rpc('apply_asaas_order_event',{target_order_id:orderId,target_event_id:fields.eventId,target_event_type:fields.eventType,target_checkout_id:fields.checkoutId,target_payment_id:fields.paymentId,target_amount_cents:fields.amountCents})
    if(rpcError)throw rpcError
    await db.from('asaas_webhook_events').update({processing_status:'processed',processed_at:new Date().toISOString(),last_error:null}).eq('id',fields.eventId)
    if(fields.eventType==='CHECKOUT_PAID')await sendWelcomeEmail(db,result).catch(()=>{})
    return json(res,200,{ok:true,status:result?.status})
  }catch(error){
    if(eventId)await db.from('asaas_webhook_events').update({processing_status:'error',last_error:String(error instanceof Error?error.message:error).slice(0,1000)}).eq('id',eventId)
    return json(res,500,{error:'Falha temporária ao processar evento.'})
  }
}

async function sendWelcomeEmail(db,result){
  if(!result?.user_id)return
  const {data:user}=await db.auth.admin.getUserById(result.user_id)
  if(!user?.user?.email)return
  await db.from('admin_email_notifications').insert({event_type:'premium_activated',recipient:user.user.email,subject:'Seu Perfil Premium MaterPlace está ativo',payload:{user_id:result.user_id,order_id:result.order_id,login_url:'https://www.materplace.com.br/login'}})
  if(process.env.RESEND_API_KEY&&process.env.ADMIN_NOTIFICATION_FROM_EMAIL){
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ADMIN_NOTIFICATION_FROM_EMAIL,to:[user.user.email],subject:'Seu Perfil Premium MaterPlace está ativo',html:'<h1>Pagamento confirmado</h1><p>Seu acesso ao Perfil Premium MaterPlace foi liberado.</p><p>Entre na plataforma para completar seus dados profissionais. A publicação ocorrerá após o preenchimento e a aprovação.</p><p><a href="https://www.materplace.com.br/login">Completar meu perfil</a></p>'})})
  }
}
