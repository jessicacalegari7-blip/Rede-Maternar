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
    const {data,error}=await adminClient().from('premium_orders').select('status,product_name,amount_cents,paid_at,expires_at').eq('public_token',token).maybeSingle()
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
    stage='account_bootstrap'
    const {organizationId,professionalId}=await ensureCheckoutAccount(db,{userId:createdUserId,name,phone})
    stage='membership_lookup'
    stage='order_creation'
    const {data:order,error:orderError}=await db.from('premium_orders').insert({user_id:createdUserId,organization_id:organizationId,professional_id:professionalId,customer_name:name,customer_email:email,customer_phone:String(phone).replace(/\D/g,''),tax_id_last4:taxId.slice(-4),amount_cents:PREMIUM_PRODUCT.amountCents,status:'creating'}).select('id,public_token').single()
    if(orderError)throw orderError
    orderId=order.id
    const statusUrl=`${baseSite()}/checkout/status?token=${order.public_token}`
    stage='asaas_checkout_creation'
    const checkout=await asaasRequest('/checkouts',{method:'POST',body:JSON.stringify({billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:60,externalReference:order.id,callback:{successUrl:statusUrl,cancelUrl:statusUrl,expiredUrl:statusUrl},items:[{name:PREMIUM_PRODUCT.name,description:'Acesso por 12 meses, sem renovação automática',quantity:1,value:PREMIUM_PRODUCT.amountCents/100}],customerData:{name,email,cpfCnpj:taxId,phone:String(phone).replace(/\D/g,'')}})})
    if(!checkout?.id)throw new Error('O Asaas não retornou o identificador do checkout.')
    stage='order_confirmation'
    const {error:updateError}=await db.from('premium_orders').update({status:'pending',asaas_checkout_id:checkout.id,expires_at:new Date(Date.now()+60*60*1000).toISOString(),updated_at:new Date().toISOString()}).eq('id',order.id)
    if(updateError)throw updateError
    return json(res,201,{orderId:order.id,statusToken:order.public_token,checkoutUrl:checkoutPageUrl(checkout.id),amountCents:PREMIUM_PRODUCT.amountCents,environment:'sandbox'})
  }catch(error){
    const db=adminClient()
    if(orderId)await db.from('premium_orders').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',orderId)
    if(createdHere&&createdUserId&&!orderId)await db.auth.admin.deleteUser(createdUserId).catch(()=>{})
    const technicalMessage=String(error?.message||error?.details||error?.hint||'Falha não identificada').slice(0,500)
    const failureStep=String(error?.checkoutStep||stage).replace(/[^a-z0-9_]/gi,'').slice(0,80)
    console.error('asaas_checkout_failed',{stage,step:failureStep,code:error?.code||null,status:error?.status||500,message:technicalMessage})
    const safeMessages={existing_user_lookup:'Não foi possível validar o e-mail informado.',auth_user_creation:'Não foi possível criar seu acesso. Verifique o e-mail e tente novamente.',account_bootstrap:'Não foi possível preparar sua conta profissional.',membership_lookup:'Não foi possível preparar sua conta profissional.',professional_lookup:'Não foi possível preparar seu perfil profissional.',order_creation:'Não foi possível registrar o pedido.',asaas_checkout_creation:'O Asaas não conseguiu criar o checkout no Sandbox.',order_confirmation:'O checkout foi criado, mas não foi possível confirmar o pedido.'}
    return json(res,error?.status||500,{error:safeMessages[stage]||'Não foi possível iniciar o checkout.',code:`checkout_${failureStep}`})
  }
}

async function ensureCheckoutAccount(db,{userId,name,phone}){
  const fail=(error,checkoutStep)=>{if(error){error.checkoutStep=checkoutStep;throw error}}
  let {data:profile,error:profileError}=await db.from('profiles').select('id').eq('id',userId).maybeSingle()
  fail(profileError,'account_profile_lookup')
  if(!profile){const created=await db.from('profiles').insert({id:userId,full_name:name,phone}).select('id').single();fail(created.error,'account_profile_creation');profile=created.data}
  let {data:organization,error:organizationError}=await db.from('organizations').select('id').eq('created_by',userId).order('created_at',{ascending:true}).limit(1).maybeSingle()
  fail(organizationError,'account_organization_lookup')
  if(!organization){const created=await db.from('organizations').insert({type:'independent',display_name:name,plan:'marketplace',status:'pending',created_by:userId}).select('id').single();fail(created.error,'account_organization_creation');organization=created.data}
  const member=await db.from('organization_members').upsert({organization_id:organization.id,user_id:userId,role:'owner',active:true},{onConflict:'organization_id,user_id'});fail(member.error,'account_membership_creation')
  let {data:professional,error:professionalError}=await db.from('professional_profiles').select('id').eq('organization_id',organization.id).eq('user_id',userId).maybeSingle()
  fail(professionalError,'account_professional_lookup')
  if(!professional){const created=await db.from('professional_profiles').insert({organization_id:organization.id,user_id:userId,full_name:name,whatsapp:phone,city:'Não informada',state_code:'SP',marketplace_visible:false}).select('id').single();fail(created.error,'account_professional_creation');professional=created.data}
  return {organizationId:organization.id,professionalId:professional.id}
}
