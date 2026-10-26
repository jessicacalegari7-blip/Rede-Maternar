import {adminClient} from './_lib/supabase-admin.mjs'
import {createHash} from 'node:crypto'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {PREMIUM_PRODUCT,asaasRequest,checkoutPageUrl,hasActivePixKey,hasPendingPixKey,normalizeTaxId,productionPilotEnvironment,validPhone,validTaxId} from './_lib/asaas.mjs'
import adminHandler from './_lib/admin-asaas-handler.mjs'
import {deliverPremiumAccessInvite,deliverPremiumActivationEmail,hashPremiumInviteToken,resendPremiumConfirmationEmail} from './_lib/premium-email.mjs'

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const baseSite=()=>String(process.env.PUBLIC_SITE_URL||process.env.PUBLIC_APP_URL||'https://www.materplace.com.br').replace(/\/$/,'')

export default async function handler(req,res){
  if(String(req.query?.admin||'')==='1')return adminHandler(req,res)
  if(String(req.query?.action||'')==='resend-confirmation')return resendConfirmation(req,res)
  if(String(req.query?.action||'')==='resend-invite')return resendInvite(req,res)
  if(String(req.query?.action||'')==='recover-invite')return recoverInvite(req,res)
  if(String(req.query?.action||'')==='invite')return premiumInvite(req,res)
  if(!allowMethods(req,res,['GET','POST']))return
  if(req.method==='GET'){
    const token=String(req.query?.token||'')
    if(!/^[0-9a-f-]{36}$/i.test(token))return json(res,400,{error:'Identificador inválido.'})
    const {data,error}=await adminClient().rpc('get_premium_checkout_status',{target_public_token:token}).maybeSingle()
    if(error||!data)return json(res,404,{error:'Pedido não encontrado.'})
    return json(res,200,data)
  }
  let orderId=null,attemptId=null,environment='sandbox',stage='validation'
  try{
    const body=await readJson(req),name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim(),taxId=normalizeTaxId(body.taxId)
    if(name.length<3)return json(res,400,{error:'Informe o nome profissional completo.'})
    if(!emailPattern.test(email))return json(res,400,{error:'Informe um e-mail válido.'})
    if(!validPhone(phone))return json(res,400,{error:'Informe um telefone ou WhatsApp válido, com DDD.'})
    if(!validTaxId(taxId))return json(res,400,{error:'O CPF ou CNPJ informado é inválido. Confira os números e tente novamente.'})
    const attribution=Object.fromEntries(Object.entries(body.attribution||{}).filter(([key,value])=>/^(utm_(source|medium|campaign|term|content)|campaign_id)$/.test(key)&&typeof value==='string').map(([key,value])=>[key,value.trim().slice(0,160)]))
    const db=adminClient()
    environment=productionPilotEnvironment({email,taxId})
    stage='order_creation'
    const {data:order,error:orderError}=await db.rpc('reserve_premium_checkout',{target_asaas_environment:environment,target_name:name,target_email:email,target_phone:phone,target_tax_id_last4:taxId.slice(-4),target_amount_cents:PREMIUM_PRODUCT.amountCents,target_attribution:attribution})
    if(orderError)throw orderError
    orderId=order.order_id
    attemptId=order.attempt_id||null
    const statusUrl=`${baseSite()}/checkout/status?token=${order.public_token}`
    if(order.status==='existing')return json(res,200,{orderId,statusToken:order.public_token,checkoutUrl:checkoutPageUrl(order.checkout_id,environment),amountCents:PREMIUM_PRODUCT.amountCents,environment})
    if(order.status!=='reserved')return json(res,409,{error:'Já existe uma tentativa em confirmação. Aguarde alguns minutos antes de tentar novamente.',code:'checkout_reconciliation_pending'})
    stage='asaas_pix_key_check'
    const pixKeys=await asaasRequest('/pix/addressKeys?limit=100',{method:'GET'},environment,{readOnly:true})
    if(!hasActivePixKey(pixKeys)){
      if(environment==='sandbox'&&!hasPendingPixKey(pixKeys))await asaasRequest('/pix/addressKeys',{method:'POST',body:JSON.stringify({type:'EVP'})},environment)
      throw Object.assign(new Error(`A chave Pix do ${environment==='sandbox'?'Sandbox':'Asaas'} ainda não está ativa. Aguarde a ativação e tente novamente.`),{status:503,inconclusive:false})
    }
    stage='asaas_checkout_creation'
    const checkoutPayload={billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:60,externalReference:order.order_id,callback:{successUrl:statusUrl,cancelUrl:statusUrl,expiredUrl:statusUrl},items:[{name:PREMIUM_PRODUCT.name,description:'Acesso por 12 meses, sem renovação automática',quantity:1,value:PREMIUM_PRODUCT.amountCents/100}]}
    const checkout=await asaasRequest('/checkouts',{method:'POST',body:JSON.stringify(checkoutPayload)},environment)
    if(!checkout?.id)throw new Error('O Asaas não retornou o identificador do checkout.')
    stage='order_confirmation'
    const {data:confirmed,error:updateError}=await db.rpc('finish_premium_checkout_attempt',{target_order_id:order.order_id,target_attempt_id:attemptId,target_checkout_id:checkout.id,target_result:'confirmed',target_expires_at:new Date(Date.now()+60*60*1000).toISOString()})
    if(updateError||!confirmed)throw Object.assign(updateError||new Error('Reserva do checkout não pôde ser confirmada.'),{inconclusive:true})
    return json(res,201,{orderId:order.order_id,statusToken:order.public_token,checkoutUrl:checkoutPageUrl(checkout.id,environment),amountCents:PREMIUM_PRODUCT.amountCents,environment})
  }catch(error){
    const db=adminClient()
    if(orderId&&attemptId)await db.rpc('finish_premium_checkout_attempt',{target_order_id:orderId,target_attempt_id:attemptId,target_checkout_id:null,target_result:error?.inconclusive?'inconclusive':'failed',target_expires_at:null})
    const technicalMessage=String(error?.message||error?.details||error?.hint||'Falha não identificada').slice(0,500)
    const failureStep=String(error?.checkoutStep||stage).replace(/[^a-z0-9_]/gi,'').slice(0,80)
    console.error('asaas_checkout_failed',{stage,step:failureStep,code:error?.code||null,status:error?.status||500,message:technicalMessage})
    const safeMessages={existing_user_lookup:'Não foi possível validar o e-mail informado.',auth_user_creation:'Não foi possível criar seu acesso. Verifique o e-mail e tente novamente.',order_creation:'Não foi possível registrar o pedido.',asaas_pix_key_check:'A chave Pix do ambiente de pagamento ainda não está ativa.',asaas_checkout_creation:'O Asaas não conseguiu criar o checkout.',order_confirmation:'O checkout foi criado, mas requer conciliação antes de uma nova tentativa.'}
    const databaseReason=/^(?:PGRST\d+|\d{5})$/.test(String(error?.code||''))?String(error.code):undefined
    return json(res,error?.status||500,{error:safeMessages[stage]||'Não foi possível iniciar o checkout.',code:`checkout_${failureStep}`,...(databaseReason?{reason:databaseReason}:{})})
  }
}
async function resendInvite(req,res){
  if(!allowMethods(req,res,['POST']))return
  try{
    const {token}=await readJson(req)
    if(!/^[0-9a-f-]{36}$/i.test(String(token||'')))return json(res,400,{error:'Identificador inválido.'})
    const db=adminClient(),{data:order,error}=await db.rpc('get_premium_order_for_confirmation',{target_public_token:token}).maybeSingle()
    if(error||!order||order.status!=='paid')return json(res,200,{ok:true,message:'Se a contratação estiver confirmada e o convite ainda for necessário, enviaremos uma nova mensagem.'})
    const status=await deliverPremiumAccessInvite(db,{orderId:order.id,force:true})
    if(status==='rate_limited')return json(res,429,{error:'Aguarde alguns minutos antes de solicitar um novo envio.'})
    if(status==='used')return json(res,200,{ok:true,message:'Se a contratação estiver confirmada e o convite ainda for necessário, enviaremos uma nova mensagem. Se você já criou a conta, entre ou recupere sua senha.'})
    if(status!=='sent')return json(res,503,{error:'Não foi possível processar a solicitação agora. Tente novamente em alguns minutos.'})
    return json(res,200,{ok:true,status,message:'Solicitação processada. Confira a caixa de entrada e também as abas Promoções, Atualizações e Spam.'})
  }catch{return json(res,500,{error:'Não foi possível reenviar o convite agora.'})}
}

async function recoverInvite(req,res){
  if(!allowMethods(req,res,['POST']))return
  const neutral='Se a contratação estiver confirmada e o convite ainda for necessário, enviaremos uma nova mensagem. Confira também Promoções, Atualizações e Spam.'
  try{
    const body=await readJson(req),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').replace(/\D/g,''),taxId=normalizeTaxId(body.taxId)
    if(!emailPattern.test(email)||!validPhone(phone)||!validTaxId(taxId))return json(res,200,{ok:true,message:neutral})
    const environment=productionPilotEnvironment({email,taxId})
    const db=adminClient(),identityHash=createHash('sha256').update(`${environment}:${email}:${phone}:${taxId}`).digest('hex')
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
    const ipHash=createHash('sha256').update(ip).digest('hex')
    const {data:allowed}=await db.rpc('allow_premium_invite_recovery',{target_identity_hash:identityHash,target_ip_hash:ipHash})
    if(!allowed)return json(res,200,{ok:true,message:neutral})
    const {data:order}=await db.from('premium_orders').select('id,status').eq('asaas_environment',environment).eq('customer_email',email).eq('customer_phone',phone).eq('tax_id_last4',taxId.slice(-4)).eq('product_code',PREMIUM_PRODUCT.code).order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(order?.status==='paid')await deliverPremiumAccessInvite(db,{orderId:order.id,force:true})
    return json(res,200,{ok:true,message:neutral})
  }catch(error){
    console.error('premium_invite_recovery_failed',{code:error?.code||null})
    return json(res,200,{ok:true,message:neutral})
  }
}
async function premiumInvite(req,res){
  const db=adminClient()
  try{
    if(req.method==='GET'){
      const token=String(req.query?.token||'')
      if(token.length<40)return json(res,400,{error:'Convite inválido.'})
      const {data,error}=await db.rpc('get_premium_access_invite',{target_token_hash:hashPremiumInviteToken(token)}).maybeSingle()
      if(error||!data)return json(res,404,{error:'Este convite expirou ou já foi utilizado.'})
      return json(res,200,data)
    }
    if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'})
    const body=await readJson(req),token=String(body.token||''),password=String(body.password||'')
    if(token.length<40||password.length<8)return json(res,400,{error:'Convite ou senha inválidos.'})
    const tokenHash=hashPremiumInviteToken(token)
    const {data:invite,error:inviteError}=await db.rpc('get_premium_access_invite',{target_token_hash:tokenHash}).maybeSingle()
    if(inviteError||!invite)return json(res,404,{error:'Este convite expirou ou já foi utilizado.'})
    let userId,createdUserId=null
    const bearer=req.headers.authorization?.replace(/^Bearer\s+/i,'')
    if(invite.existing_account){
      if(!bearer)return json(res,409,{error:'Este e-mail já possui conta. Entre na MaterPlace e abra novamente o convite.',code:'existing_account'})
      const {data:auth}=await db.auth.getUser(bearer)
      if(!auth.user||auth.user.email?.toLowerCase()!==String(invite.email).toLowerCase())return json(res,403,{error:'Entre com a conta correspondente ao convite.'})
      userId=auth.user.id
    }else{
      const {data:created,error:createError}=await db.auth.admin.createUser({email:invite.email,password,email_confirm:true,user_metadata:{account_type:'professional',full_name:invite.name,phone:invite.phone,plan:'marketplace',signup_source:'asaas_premium_invite'}})
      if(createError||!created.user)throw createError||new Error('Não foi possível criar o acesso.')
      userId=created.user.id
      createdUserId=userId
    }
    const {data:result,error:redeemError}=await db.rpc('redeem_premium_access_invite',{target_token_hash:tokenHash,target_user_id:userId})
    if(redeemError){
      if(createdUserId)await db.auth.admin.deleteUser(createdUserId).catch(()=>undefined)
      throw redeemError
    }
    return json(res,200,{ok:true,status:result?.status||'active',redirect:'/profissional/perfil'})
  }catch(error){console.error('premium_invite_failed',{code:error?.code||null});return json(res,500,{error:'Não foi possível criar o acesso agora. Tente novamente.'})}
}
async function resendConfirmation(req,res){
  if(!allowMethods(req,res,['POST']))return
  try{
    const {token}=await readJson(req)
    if(!/^[0-9a-f-]{36}$/i.test(String(token||'')))return json(res,400,{error:'Identificador inválido.'})
    const db=adminClient(),{data:order,error}=await db.rpc('get_premium_order_for_confirmation',{target_public_token:token}).maybeSingle()
    if(error||!order||order.status!=='paid')return json(res,404,{error:'Pagamento confirmado não encontrado.'})
    const status=await resendPremiumConfirmationEmail(db,{userId:order.user_id,orderId:order.id})
    if(status==='rate_limited')return json(res,429,{error:'Aguarde alguns minutos antes de solicitar um novo envio.'})
    if(status==='already_confirmed'){
      const activationStatus=await deliverPremiumActivationEmail(db,{userId:order.user_id,orderId:order.id})
      if(activationStatus==='sent'||activationStatus==='already_sent')return json(res,200,{ok:true,status:activationStatus,message:activationStatus==='sent'?'E-mail de ativação enviado. Confira também a pasta de spam.':'O e-mail de ativação já foi enviado.'})
      if(activationStatus==='already_processing')return json(res,202,{ok:true,status:activationStatus,message:'O e-mail de ativação já está sendo processado.'})
      return json(res,503,{error:'Não foi possível enviar agora. Tente novamente em alguns minutos.'})
    }
    if(status!=='sent')return json(res,503,{error:'Não foi possível enviar agora. Tente novamente em alguns minutos.'})
    return json(res,200,{ok:true,status,message:'E-mail de confirmação reenviado. Confira também a pasta de spam.'})
  }catch{return json(res,500,{error:'Não foi possível reenviar a confirmação agora.'})}
}


