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
  return eventType==='PAYMENT_CHARGEBACK_DISPUTE'?'PAYMENT_CHARGEBACK_REQUESTED':eventType
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
  }
}
