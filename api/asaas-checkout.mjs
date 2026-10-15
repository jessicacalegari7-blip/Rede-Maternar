import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {PREMIUM_PRODUCT,asaasRequest,checkoutPageUrl,normalizeTaxId,validPhone,validTaxId} from './_lib/asaas.mjs'
import adminHandler from './_lib/admin-asaas-handler.mjs'

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const baseSite=()=>String(process.env.PUBLIC_SITE_URL||process.env.PUBLIC_APP_URL||'https://www.materplace.com.br').replace(/\/$/,'')

export default async function handler(req,res){
  if(String(req.query?.admin||'')==='1')return adminHandler(req,res)
  if(!allowMethods(req,res,['GET','POST']))return
  if(req.method==='GET'){
    const token=String(req.query?.token||'')
    if(!/^[0-9a-f-]{36}$/i.test(token))return json(res,400,{error:'Identificador inválido.'})
    const {data,error}=await adminClient().rpc('get_premium_checkout_status',{target_public_token:token}).maybeSingle()
    if(error||!data)return json(res,404,{error:'Pedido não encontrado.'})
    return json(res,200,data)
  }
  let createdUserId=null,createdHere=false,orderId=null,stage='validation'
  try{
    if(String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()==='production')throw Object.assign(new Error('Checkout real ainda não foi autorizado.'),{status:503})
    const body=await readJson(req),name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim(),taxId=normalizeTaxId(body.taxId),password=String(body.password||'')
    if(name.length<3||!emailPattern.test(email)||!validPhone(phone)||!validTaxId(taxId)||password.length<8)return json(res,400,{error:'Informe nome, e-mail, telefone, CPF/CNPJ e senha com ao menos 8 caracteres.'})
    const db=adminClient();stage='existing_user_lookup'
    const {data:existing,error:existingError}=await db.rpc('find_checkout_user_by_email',{target_email:email})
    if(existingError)throw existingError
    if(existing?.length){
      const {data:existingAuth,error:existingAuthError}=await db.auth.admin.getUserById(existing[0].user_id)
      if(existingAuthError||existingAuth?.user?.user_metadata?.signup_source!=='asaas_premium')return json(res,409,{error:'Já existe uma conta com este e-mail. Entre na plataforma para contratar ou continuar o pagamento.'})
      createdUserId=existing[0].user_id
    }else{
      stage='auth_user_creation'
      const {data:auth,error:authError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{account_type:'professional',full_name:name,phone,plan:'marketplace',organization_name:name,city:'Não informada',state_code:'SP',signup_source:'asaas_premium'}})
      if(authError||!auth.user)throw authError||new Error('Não foi possível criar o acesso seguro.')
      createdUserId=auth.user.id;createdHere=true
    }
    stage='order_creation'
    const {data:order,error:orderError}=await db.rpc('create_premium_checkout_order',{target_user_id:createdUserId,target_name:name,target_email:email,target_phone:phone,target_tax_id_last4:taxId.slice(-4),target_amount_cents:PREMIUM_PRODUCT.amountCents}).single()
    if(orderError)throw orderError
    orderId=order.order_id
    const statusUrl=`${baseSite()}/checkout/status?token=${order.public_token}`
    stage='asaas_checkout_creation'
    const checkoutPayload={billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:60,externalReference:order.order_id,callback:{successUrl:statusUrl,cancelUrl:statusUrl,expiredUrl:statusUrl},items:[{name:PREMIUM_PRODUCT.name,description:'Acesso por 12 meses, sem renovação automática',quantity:1,value:PREMIUM_PRODUCT.amountCents/100}]}
    let checkout
    try{checkout=await asaasRequest('/checkouts',{method:'POST',body:JSON.stringify(checkoutPayload)})}
    catch(error){
      if(String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()!=='sandbox'||!/chave pix/i.test(String(error?.message||'')))throw error
      stage='asaas_pix_key_setup'
      const keys=await asaasRequest('/pix/addressKeys?limit=10')
      if(!Array.isArray(keys?.data)||!keys.data.some(key=>['ACTIVE','AWAITING_ACTIVATION'].includes(key?.status)))await asaasRequest('/pix/addressKeys',{method:'POST',body:JSON.stringify({type:'EVP'})})
      stage='asaas_checkout_creation'
      checkout=await asaasRequest('/checkouts',{method:'POST',body:JSON.stringify(checkoutPayload)})
    }
    if(!checkout?.id)throw new Error('O Asaas não retornou o identificador do checkout.')
    stage='order_confirmation'
    const {error:updateError}=await db.rpc('update_premium_checkout_order',{target_order_id:order.order_id,target_status:'pending',target_checkout_id:checkout.id,target_expires_at:new Date(Date.now()+60*60*1000).toISOString()})
    if(updateError)throw updateError
    return json(res,201,{orderId:order.order_id,statusToken:order.public_token,checkoutUrl:checkoutPageUrl(checkout.id),amountCents:PREMIUM_PRODUCT.amountCents,environment:'sandbox'})
  }catch(error){
    const db=adminClient()
    if(orderId)await db.rpc('update_premium_checkout_order',{target_order_id:orderId,target_status:'failed',target_checkout_id:null,target_expires_at:null})
    if(createdHere&&createdUserId&&!orderId)await db.auth.admin.deleteUser(createdUserId).catch(()=>{})
    const technicalMessage=String(error?.message||error?.details||error?.hint||'Falha não identificada').slice(0,500)
    const failureStep=String(error?.checkoutStep||stage).replace(/[^a-z0-9_]/gi,'').slice(0,80)
    console.error('asaas_checkout_failed',{stage,step:failureStep,code:error?.code||null,status:error?.status||500,message:technicalMessage})
    const safeMessages={existing_user_lookup:'Não foi possível validar o e-mail informado.',auth_user_creation:'Não foi possível criar seu acesso. Verifique o e-mail e tente novamente.',order_creation:'Não foi possível registrar o pedido.',asaas_pix_key_setup:'A conta Sandbox do Asaas ainda não está habilitada para receber Pix.',asaas_checkout_creation:'O Asaas não conseguiu criar o checkout no Sandbox.',order_confirmation:'O checkout foi criado, mas não foi possível confirmar o pedido.'}
    const databaseReason=/^(?:PGRST\d+|\d{5})$/.test(String(error?.code||''))?String(error.code):undefined
    const providerDetail=stage.startsWith('asaas_')?technicalMessage.replace(/[\r\n]+/g,' ').slice(0,180):undefined
    return json(res,error?.status||500,{error:safeMessages[stage]||'Não foi possível iniciar o checkout.',code:`checkout_${failureStep}`,...(databaseReason?{reason:databaseReason}:{}),...(providerDetail?{detail:providerDetail}:{})})
  }
}

