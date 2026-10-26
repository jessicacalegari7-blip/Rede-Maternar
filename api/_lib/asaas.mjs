import {createHash,timingSafeEqual} from 'node:crypto'

export const PREMIUM_PRODUCT={code:'premium_annual',name:'Perfil Premium MaterPlace',amountCents:5999,validityMonths:12}

export function normalizeAsaasEnvironment(value=process.env.ASAAS_ENVIRONMENT){
  return String(value||'sandbox').toLowerCase()==='production'?'production':'sandbox'
}

export function asaasBaseUrl(environment=normalizeAsaasEnvironment()){
  return environment==='production'
    ?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3'
}

export function checkoutPageUrl(id,environment=normalizeAsaasEnvironment()){
  const host=environment==='production'?'https://asaas.com':'https://sandbox.asaas.com'
  return `${host}/checkoutSession/show?id=${encodeURIComponent(id)}`
}

export async function asaasRequest(path,options={},environment=normalizeAsaasEnvironment(),{readOnly=false}={}){
  if(environment==='production'&&!readOnly&&process.env.ASAAS_PRODUCTION_CHARGES_ENABLED!=='true'){
    throw Object.assign(new Error('Operações financeiras reais ainda não foram autorizadas.'),{status:503})
  }
  const key=(environment==='production'?process.env.ASAAS_PRODUCTION_API_KEY:process.env.ASAAS_API_KEY)?.trim()
  if(!key)throw Object.assign(new Error('Integração Asaas ainda não configurada.'),{status:503})
  const response=await fetch(`${asaasBaseUrl(environment)}${path}`,{...options,headers:{accept:'application/json','content-type':'application/json',access_token:key,'User-Agent':'MaterPlace/1.0',...options.headers}})
  const data=await response.json().catch(()=>({}))
  if(!response.ok){
    const message=data?.errors?.map(item=>item.description).filter(Boolean).join('; ')||`Asaas respondeu HTTP ${response.status}`
    throw Object.assign(new Error(message),{status:response.status>=500?502:400,providerStatus:response.status,inconclusive:response.status>=500})
  }
  return data
}

export function normalizeTaxId(value){return String(value||'').replace(/\D/g,'')}
function validCpf(digits){
  if(!/^\d{11}$/.test(digits)||/^(\d)\1{10}$/.test(digits))return false
  for(let position=9;position<11;position++){
    let sum=0
    for(let index=0;index<position;index++)sum+=Number(digits[index])*(position+1-index)
    let verifier=(sum*10)%11
    if(verifier===10)verifier=0
    if(verifier!==Number(digits[position]))return false
  }
  return true
}
function validCnpj(digits){
  if(!/^\d{14}$/.test(digits)||/^(\d)\1{13}$/.test(digits))return false
  const calculate=length=>{
    let sum=0,weight=length-7
    for(let index=0;index<length;index++){
      sum+=Number(digits[index])*weight--
      if(weight===1)weight=9
    }
    const remainder=sum%11
    return remainder<2?0:11-remainder
  }
  return calculate(12)===Number(digits[12])&&calculate(13)===Number(digits[13])
}
export function validTaxId(value){const digits=normalizeTaxId(value);return validCpf(digits)||validCnpj(digits)}
export function validPhone(value){return String(value||'').replace(/\D/g,'').length>=10}
export function hasActivePixKey(payload){return Array.isArray(payload?.data)&&payload.data.some(key=>key?.status==='ACTIVE')}
export function hasPendingPixKey(payload){return Array.isArray(payload?.data)&&payload.data.some(key=>key?.status==='AWAITING_ACTIVATION')}
export function safeEqual(left,right){
  const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''))
  if(a.length!==b.length)return false
  return timingSafeEqual(a,b)
}

export function processableEventType(eventType){
  return eventType
}

export function eventFields(payload){
  const checkout=payload?.checkout||{}
  const payment=payload?.payment||checkout?.payment||{}
  const externalReference=checkout.externalReference||payment.externalReference||payload?.externalReference||null
  const itemsTotal=Array.isArray(checkout.items)?checkout.items.reduce((total,item)=>{
    const value=Number(item?.value),quantity=Number(item?.quantity??1)
    return Number.isFinite(value)&&Number.isFinite(quantity)?total+(value*quantity):total
  },0):null
  const rawValue=checkout.value??payment.value??checkout.totalValue??payload?.value??itemsTotal
  return {
    eventId:String(payload?.id||''),eventType:String(payload?.event||''),checkoutId:checkout.id||payload?.checkoutId||null,
    paymentId:payment.id||checkout.paymentId||null,externalReference:externalReference?String(externalReference):null,
    amountCents:Number.isFinite(Number(rawValue))?Math.round(Number(rawValue)*100):null,
    refundedAmountCents:Number.isFinite(Number(payment.refundedValue))?Math.round(Number(payment.refundedValue)*100):null,
  }
}

export function validateCheckoutPaidPayload(payload){
  const checkout=payload?.checkout||{}
  if(!checkout.id)throw Object.assign(new Error('Checkout sem identificador.'),{code:'invalid_checkout'})
  if(checkout.status&&checkout.status!=='PAID')throw Object.assign(new Error('Checkout não está pago.'),{code:'checkout_not_paid'})
  if(Array.isArray(checkout.chargeTypes)&&!checkout.chargeTypes.includes('DETACHED'))throw Object.assign(new Error('Tipo de cobrança inesperado.'),{code:'invalid_charge_type'})
  if(checkout.currency&&checkout.currency!=='BRL')throw Object.assign(new Error('Moeda inesperada.'),{code:'invalid_currency'})
  if(Array.isArray(checkout.items)){
    if(checkout.items.length!==1)throw Object.assign(new Error('Itens do checkout divergentes.'),{code:'invalid_items'})
    const item=checkout.items[0]
    if(String(item?.name||'')!==PREMIUM_PRODUCT.name||Number(item?.quantity)!==1||Math.round(Number(item?.value)*100)!==PREMIUM_PRODUCT.amountCents)throw Object.assign(new Error('Produto do checkout divergente.'),{code:'invalid_product'})
  }
  return true
}

const paidStatuses=new Set(['CONFIRMED','RECEIVED','RECEIVED_IN_CASH'])
export async function reconcilePaidEvent(fields,environment){
  if(!fields.paymentId)throw Object.assign(new Error('Evento pago sem identificador da cobrança.'),{code:'missing_payment_id'})
  const payment=await asaasRequest(`/payments/${encodeURIComponent(fields.paymentId)}`,{method:'GET'},environment,{readOnly:true})
  const amountCents=Math.round(Number(payment?.value)*100)
  if(payment?.id!==fields.paymentId)throw Object.assign(new Error('Identificador financeiro divergente.'),{code:'payment_mismatch'})
  if(!paidStatuses.has(String(payment?.status||'')))throw Object.assign(new Error('Cobrança ainda não confirmada pela API.'),{code:'payment_not_confirmed'})
  if(amountCents!==PREMIUM_PRODUCT.amountCents)throw Object.assign(new Error('Valor financeiro divergente.'),{code:'amount_mismatch'})
  if(String(payment?.externalReference||'')!==String(fields.externalReference||''))throw Object.assign(new Error('Referência financeira divergente.'),{code:'reference_mismatch'})
  return {paymentId:payment.id,externalReference:payment.externalReference,amountCents,status:payment.status,billingType:payment.billingType}
}

export function productionPilotEnvironment({email,taxId}={}){
  const enabled=process.env.ASAAS_PRODUCTION_CHARGES_ENABLED==='true'
  const pilotEnabled=process.env.ASAAS_PRODUCTION_PILOT_ENABLED==='true'
  const authorizedEmail=String(process.env.ASAAS_PRODUCTION_PILOT_EMAIL||'').trim().toLowerCase()
  const authorizedTaxHash=String(process.env.ASAAS_PRODUCTION_PILOT_TAX_ID_SHA256||'').trim().toLowerCase()
  if(!enabled||!pilotEnabled||!authorizedEmail||!authorizedTaxHash)return 'sandbox'
  const normalizedEmail=String(email||'').trim().toLowerCase()
  const normalizedTaxId=normalizeTaxId(taxId)
  const taxHash=createHash('sha256').update(normalizedTaxId).digest('hex')
  return safeEqual(normalizedEmail,authorizedEmail)&&safeEqual(taxHash,authorizedTaxHash)?'production':'sandbox'
}
