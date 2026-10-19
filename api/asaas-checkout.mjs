import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {PREMIUM_PRODUCT,asaasRequest,checkoutPageUrl,hasActivePixKey,hasPendingPixKey,normalizeTaxId,validPhone,validTaxId} from './_lib/asaas.mjs'
import adminHandler from './_lib/admin-asaas-handler.mjs'
import {deliverPremiumAccessInvite,deliverPremiumActivationEmail,hashPremiumInviteToken,resendPremiumConfirmationEmail} from './_lib/premium-email.mjs'

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const baseSite=()=>String(process.env.PUBLIC_SITE_URL||process.env.PUBLIC_APP_URL||'https://www.materplace.com.br').replace(/\/$/,'')

export default async function handler(req,res){
  if(String(req.query?.admin||'')==='1')return adminHandler(req,res)
  if(String(req.query?.action||'')==='resend-confirmation')return resendConfirmation(req,res)
  if(String(req.query?.action||'')==='resend-invite')return resendInvite(req,res)
  if(String(req.query?.action||'')==='invite')return premiumInvite(req,res)
  if(!allowMethods(req,res,['GET','POST']))return
  if(req.method==='GET'){
    const token=String(req.query?.token||'')
    if(!/^[0-9a-f-]{36}$/i.test(token))return json(res,400,{error:'Identificador inválido.'})
    const {data,error}=await adminClient().rpc('get_premium_checkout_status',{target_public_token:token}).maybeSingle()
    if(error||!data)return json(res,404,{error:'Pedido não encontrado.'})
    return json(res,200,data)
  }
  let orderId=null,stage='validation'
  try{
    if(String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()==='production')throw Object.assign(new Error('Checkout real ainda não foi autorizado.'),{status:503})
    const body=await readJson(req),name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim(),taxId=normalizeTaxId(body.taxId)
    if(name.length<3||!emailPattern.test(email)||!validPhone(phone)||!validTaxId(taxId))return json(res,400,{error:'Informe nome, e-mail, telefone e CPF/CNPJ válidos.'})
    const attribution=Object.fromEntries(Object.entries(body.attribution||{}).filter(([key,value])=>/^(utm_(source|medium|campaign|term|content)|campaign_id)$/.test(key)&&typeof value==='string').map(([key,value])=>[key,value.trim().slice(0,160)]))
    const db=adminClient()
    stage='order_creation'
    const {data:order,error:orderError}=await db.rpc('create_premium_guest_order',{target_name:name,target_email:email,target_phone:phone,target_tax_id_last4:taxId.slice(-4),target_amount_cents:PREMIUM_PRODUCT.amountCents,target_attribution:attribution}).single()
    if(orderError)throw orderError
    orderId=order.order_id
    const statusUrl=`${baseSite()}/checkout/status?token=${order.public_token}`
    stage='asaas_pix_key_check'
    const pixKeys=await asaasRequest('/pix/addressKeys?limit=100')
    if(!hasActivePixKey(pixKeys)){
      if(!hasPendingPixKey(pixKeys))await asaasRequest('/pix/addressKeys',{method:'POST',body:JSON.stringify({type:'EVP'})})
      throw Object.assign(new Error('A chave Pix do Sandbox ainda não está ativa. Aguarde a ativação no Asaas e tente novamente.'),{status:503})
    }
    stage='asaas_checkout_creation'
    const checkoutPayload={billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:60,externalReference:order.order_id,customerData:{name,email,phone:phone.replace(/\D/g,''),cpfCnpj:taxId},callback:{successUrl:statusUrl,cancelUrl:statusUrl,expiredUrl:statusUrl},items:[{name:PREMIUM_PRODUCT.name,description:'Acesso por 12 meses, sem renovação automática',quantity:1,value:PREMIUM_PRODUCT.amountCents/100}]}
    const checkout=await asaasRequest('/checkouts',{method:'POST',body:JSON.stringify(checkoutPayload)})
    if(!checkout?.id)throw new Error('O Asaas não retornou o identificador do checkout.')
    stage='order_confirmation'
    const {error:updateError}=await db.rpc('update_premium_checkout_order',{target_order_id:order.order_id,target_status:'pending',target_checkout_id:checkout.id,target_expires_at:new Date(Date.now()+60*60*1000).toISOString()})
    if(updateError)throw updateError
    return json(res,201,{orderId:order.order_id,statusToken:order.public_token,checkoutUrl:checkoutPageUrl(checkout.id),amountCents:PREMIUM_PRODUCT.amountCents,environment:'sandbox'})
  }catch(error){
    const db=adminClient()
    if(orderId)await db.rpc('update_premium_checkout_order',{target_order_id:orderId,target_status:'failed',target_checkout_id:null,target_expires_at:null})
    const technicalMessage=String(error?.message||error?.details||error?.hint||'Falha não identificada').slice(0,500)
    const failureStep=String(error?.checkoutStep||stage).replace(/[^a-z0-9_]/gi,'').slice(0,80)
    console.error('asaas_checkout_failed',{stage,step:failureStep,code:error?.code||null,status:error?.status||500,message:technicalMessage})
    const safeMessages={existing_user_lookup:'Não foi possível validar o e-mail informado.',auth_user_creation:'Não foi possível criar seu acesso. Verifique o e-mail e tente novamente.',order_creation:'Não foi possível registrar o pedido.',asaas_pix_key_check:'A chave Pix do Sandbox ainda não está ativa. Verifique a área Pix do Asaas.',asaas_checkout_creation:'O Asaas não conseguiu criar o checkout no Sandbox.',order_confirmation:'O checkout foi criado, mas não foi possível confirmar o pedido.'}
    const databaseReason=/^(?:PGRST\d+|\d{5})$/.test(String(error?.code||''))?String(error.code):undefined
    const providerDetail=stage.startsWith('asaas_')?technicalMessage.replace(/[\r\n]+/g,' ').slice(0,180):undefined
    return json(res,error?.status||500,{error:safeMessages[stage]||'Não foi possível iniciar o checkout.',code:`checkout_${failureStep}`,...(databaseReason?{reason:databaseReason}:{}),...(providerDetail?{detail:providerDetail}:{})})
  }
}
async function resendInvite(req,res){
  if(!allowMethods(req,res,['POST']))return
  try{
    const {token}=await readJson(req)
    if(!/^[0-9a-f-]{36}$/i.test(String(token||'')))return json(res,400,{error:'Identificador inválido.'})
    const db=adminClient(),{data:order,error}=await db.rpc('get_premium_order_for_confirmation',{target_public_token:token}).maybeSingle()
    if(error||!order||order.status!=='paid')return json(res,404,{error:'Pagamento confirmado não encontrado.'})
    if(order.user_id){
      const activationStatus=await deliverPremiumActivationEmail(db,{userId:order.user_id,orderId:order.id})
      return json(res,200,{ok:true,status:activationStatus,message:activationStatus==='sent'?'E-mail de ativação enviado.':'O e-mail de ativação já foi enviado.'})
    }
    const status=await deliverPremiumAccessInvite(db,{orderId:order.id,force:true})
    if(status==='rate_limited')return json(res,429,{error:'Aguarde alguns minutos antes de solicitar um novo envio.'})
    if(status!=='sent')return json(res,503,{error:'Não foi possível enviar agora. Tente novamente em alguns minutos.'})
    return json(res,200,{ok:true,status,message:'Convite reenviado. Confira também a pasta de spam.'})
  }catch{return json(res,500,{error:'Não foi possível reenviar o convite agora.'})}
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


