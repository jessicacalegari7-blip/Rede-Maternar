import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {eventFields,safeEqual} from './_lib/asaas.mjs'

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
    let emailStatus=null
    if(fields.eventType==='CHECKOUT_PAID'&&!result.duplicate)emailStatus=await sendWelcomeEmail(db,result).catch(()=>'failed_to_record')
    return json(res,200,{ok:true,status:result?.status,duplicate:Boolean(result?.duplicate),ignored:Boolean(result?.ignored),emailStatus})
  }catch{
    return json(res,500,{error:'Falha temporária ao processar evento.'})
  }
}

async function sendWelcomeEmail(db,result){
  if(!result?.user_id||!result?.order_id)return 'not_applicable'
  const {data:user}=await db.auth.admin.getUserById(result.user_id)
  if(!user?.user?.email)return 'recipient_missing'
  const record=async(status,lastError=null)=>{
    const {data,error}=await db.rpc('record_premium_activation_email',{target_user_id:result.user_id,target_order_id:result.order_id,target_status:status,target_last_error:lastError})
    if(error)throw error
    return data
  }
  if(!process.env.RESEND_API_KEY?.trim()||!process.env.ADMIN_NOTIFICATION_FROM_EMAIL?.trim()){
    await record('pending','Provedor de e-mail não configurado.')
    return 'pending_configuration'
  }
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ADMIN_NOTIFICATION_FROM_EMAIL,to:[user.user.email],subject:'Seu Perfil Premium MaterPlace está ativo',html:'<h1>Pagamento confirmado</h1><p>A contratação do Perfil Premium MaterPlace foi confirmada.</p><p>Seu plano possui validade de 12 meses. O acesso à área de edição já está liberado para você completar seus dados profissionais.</p><p>Depois de completar o perfil, envie-o para aprovação. A publicação no diretório ocorrerá somente após a aprovação administrativa.</p><p><a href="https://www.materplace.com.br/login">Acessar a MaterPlace e completar meu perfil</a></p><p>Por segurança, a MaterPlace nunca envia sua senha por e-mail.</p>'})})
    if(!response.ok)throw new Error(`Provedor respondeu HTTP ${response.status}`)
    await record('sent')
    return 'sent'
  }catch(error){
    await record('failed',String(error instanceof Error?error.message:error).slice(0,500))
    return 'failed'
  }
}
