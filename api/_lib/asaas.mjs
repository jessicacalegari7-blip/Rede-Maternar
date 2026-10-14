import {timingSafeEqual} from 'node:crypto'

export const PREMIUM_PRODUCT={code:'premium_annual',name:'Perfil Premium MaterPlace',amountCents:5999,validityMonths:12}

export function asaasBaseUrl(){
  return String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()==='production'
    ?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3'
}

export function checkoutPageUrl(id){
  const host=String(process.env.ASAAS_ENVIRONMENT||'sandbox').toLowerCase()==='production'?'https://asaas.com':'https://sandbox.asaas.com'
  return `${host}/checkoutSession/show?id=${encodeURIComponent(id)}`
}

export async function asaasRequest(path,options={}){
  const key=process.env.ASAAS_API_KEY?.trim()
  if(!key)throw Object.assign(new Error('Integração Asaas ainda não configurada.'),{status:503})
  const response=await fetch(`${asaasBaseUrl()}${path}`,{...options,headers:{accept:'application/json','content-type':'application/json',access_token:key,'User-Agent':'MaterPlace/1.0',...options.headers}})
  const data=await response.json().catch(()=>({}))
  if(!response.ok){
    const message=data?.errors?.map(item=>item.description).filter(Boolean).join('; ')||`Asaas respondeu HTTP ${response.status}`
    throw Object.assign(new Error(message),{status:response.status>=500?502:400})
  }
  return data
}

export function normalizeTaxId(value){return String(value||'').replace(/\D/g,'')}
export function validTaxId(value){const digits=normalizeTaxId(value);return digits.length===11||digits.length===14}
export function validPhone(value){return String(value||'').replace(/\D/g,'').length>=10}
export function safeEqual(left,right){
  const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''))
  if(a.length!==b.length)return false
  return timingSafeEqual(a,b)
}

export function processableEventType(eventType){
  return eventType==='PAYMENT_CHARGEBACK_DISPUTE'?'PAYMENT_CHARGEBACK_REQUESTED':eventType
}

export function eventFields(payload){
  const checkout=payload?.checkout||{}
  const payment=payload?.payment||checkout?.payment||{}
  const externalReference=checkout.externalReference||payment.externalReference||payload?.externalReference||null
  const rawValue=checkout.value??payment.value??checkout.totalValue??payload?.value
  return {
    eventId:String(payload?.id||''),eventType:String(payload?.event||''),checkoutId:checkout.id||payload?.checkoutId||null,
    paymentId:payment.id||checkout.paymentId||null,externalReference:externalReference?String(externalReference):null,
    amountCents:Number.isFinite(Number(rawValue))?Math.round(Number(rawValue)*100):null,
  }
}
