import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {PREMIUM_PRODUCT,asaasRequest,checkoutPageUrl,normalizeTaxId,validPhone,validTaxId} from './_lib/asaas.mjs'

const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
const baseSite=()=>String(process.env.PUBLIC_SITE_URL||process.env.PUBLIC_APP_URL||'https://www.materplace.com.br').replace(/\/$/,'')

export default async function handler(req,res){
  if(!allowMethods(req,res,['GET','POST']))return
  if(req.method==='GET'){
    const token=String(req.query?.token||'')
    if(!/^[0-9a-f-]{36}$/i.test(token))return json(res,400,{error:'Identificador inválido.'})
    const {data,error}=await adminClient().from('premium_orders').select('status,product_name,amount_cents,paid_at,expires_at').eq('public_token',token).maybeSingle()
    if(error||!data)return json(res,404,{error:'Pedido não encontrado.'})
    return json(res,200,data)
  }
  let createdUserId=null,orderId=null
  try{
    if(String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()==='production')throw Object.assign(new Error('Checkout real ainda não foi autorizado.'),{status:503})
    const body=await readJson(req),name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim(),taxId=normalizeTaxId(body.taxId),password=String(body.password||'')
    if(name.length<3||!emailPattern.test(email)||!validPhone(phone)||!validTaxId(taxId)||password.length<8)return json(res,400,{error:'Informe nome, e-mail, telefone, CPF/CNPJ e senha com ao menos 8 caracteres.'})
    const db=adminClient()
    const {data:existing}=await db.rpc('find_checkout_user_by_email',{target_email:email})
    if(existing?.length)return json(res,409,{error:'Já existe uma conta com este e-mail. Entre na plataforma para contratar ou continuar o pagamento.'})
    const {data:auth,error:authError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{account_type:'professional',full_name:name,phone,plan:'marketplace',organization_name:name,city:'Não informada',state_code:'SP',signup_source:'asaas_premium'}})
    if(authError||!auth.user)throw authError||new Error('Não foi possível criar o acesso seguro.')
    createdUserId=auth.user.id
    const {data:member,error:memberError}=await db.from('organization_members').select('organization_id').eq('user_id',createdUserId).eq('active',true).single()
    if(memberError)throw memberError
    const {data:professional,error:professionalError}=await db.from('professional_profiles').select('id').eq('organization_id',member.organization_id).eq('user_id',createdUserId).single()
    if(professionalError)throw professionalError
    const {data:order,error:orderError}=await db.from('premium_orders').insert({user_id:createdUserId,organization_id:member.organization_id,professional_id:professional.id,customer_name:name,customer_email:email,customer_phone:String(phone).replace(/\D/g,''),tax_id_last4:taxId.slice(-4),amount_cents:PREMIUM_PRODUCT.amountCents,status:'creating'}).select('id,public_token').single()
    if(orderError)throw orderError
    orderId=order.id
    const statusUrl=`${baseSite()}/checkout/status?token=${order.public_token}`
    const checkout=await asaasRequest('/checkouts',{method:'POST',body:JSON.stringify({billingTypes:['PIX','CREDIT_CARD'],chargeTypes:['DETACHED'],minutesToExpire:60,externalReference:order.id,callback:{successUrl:statusUrl,cancelUrl:statusUrl,expiredUrl:statusUrl},items:[{name:PREMIUM_PRODUCT.name,description:'Acesso por 12 meses, sem renovação automática',quantity:1,value:PREMIUM_PRODUCT.amountCents/100}],customerData:{name,email,cpfCnpj:taxId,phone:String(phone).replace(/\D/g,'')}})})
    if(!checkout?.id)throw new Error('O Asaas não retornou o identificador do checkout.')
    const {error:updateError}=await db.from('premium_orders').update({status:'pending',asaas_checkout_id:checkout.id,expires_at:new Date(Date.now()+60*60*1000).toISOString(),updated_at:new Date().toISOString()}).eq('id',order.id)
    if(updateError)throw updateError
    return json(res,201,{orderId:order.id,statusToken:order.public_token,checkoutUrl:checkoutPageUrl(checkout.id),amountCents:PREMIUM_PRODUCT.amountCents,environment:'sandbox'})
  }catch(error){
    const db=adminClient()
    if(orderId)await db.from('premium_orders').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',orderId)
    if(createdUserId&&!orderId)await db.auth.admin.deleteUser(createdUserId).catch(()=>{})
    return json(res,error.status||500,{error:error instanceof Error?error.message:'Não foi possível iniciar o checkout.'})
  }
}
