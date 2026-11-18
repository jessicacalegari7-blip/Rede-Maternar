import {createHash} from 'node:crypto'

const allowedEvents=new Set(['PageView','ViewContent','Lead','CompleteRegistration','InitiateCheckout','Purchase'])
const hash=value=>createHash('sha256').update(String(value||'').trim().toLowerCase()).digest('hex')
const cleanObject=(value,allowed)=>Object.fromEntries(Object.entries(value||{}).filter(([key,item])=>allowed.includes(key)&&['string','number','boolean'].includes(typeof item)).map(([key,item])=>[key,typeof item==='string'?item.slice(0,500):item]))

export function marketingUserData({email,phone,fbp,fbc,userAgent}={}){
  const normalizedPhone=String(phone||'').replace(/\D/g,'')
  return { ...(email?{em:[hash(email)]}:{}),...(normalizedPhone?{ph:[hash(normalizedPhone)]}:{}),...(fbp?{fbp:String(fbp).slice(0,240)}:{}),...(fbc?{fbc:String(fbc).slice(0,300)}:{}),...(userAgent?{client_user_agent:String(userAgent).slice(0,500)}:{}) }
}

export async function queueMarketingEvent(db,{eventId,eventName,sourceUrl,orderId=null,valueCents=null,currency='BRL',userData={},customData={},attribution={},consent=false}){
  if(!allowedEvents.has(eventName)||!consent)return {queued:false,reason:'disabled_or_without_consent'}
  if(process.env.META_MARKETING_COLLECTION_ENABLED!=='true')return {queued:false,reason:'collection_disabled'}
  const safeAttribution=cleanObject(attribution,['utm_source','utm_medium','utm_campaign','utm_term','utm_content','campaign_id','fbp','fbc','session_id'])
  const {data,error}=await db.rpc('queue_marketing_event',{target_event_id:String(eventId).slice(0,180),target_event_name:eventName,target_source_url:String(sourceUrl||'').slice(0,1000),target_order_id:orderId,target_value_cents:valueCents,target_currency:currency,target_user_data:userData,target_custom_data:cleanObject(customData,['content_name','content_type','value','currency','order_id']),target_attribution:safeAttribution,target_consent:true})
  if(error)throw error
  return {queued:Boolean(data)}
}

export async function sendMetaConversion(payload,{fetchImpl=fetch,env=process.env}={}){
  if(env.META_CAPI_ENABLED!=='true')return {status:'disabled'}
  const dataset=String(env.META_DATASET_ID||'').trim(),token=String(env.META_CAPI_ACCESS_TOKEN||'').trim()
  if(!dataset||!token)throw new Error('meta_capi_not_configured')
  const body={data:[payload],...(env.META_TEST_EVENT_CODE?{test_event_code:env.META_TEST_EVENT_CODE}:{})}
  const response=await fetchImpl(`https://graph.facebook.com/v21.0/${encodeURIComponent(dataset)}/events`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)})
  if(!response.ok)throw new Error(`meta_capi_http_${response.status}`)
  const result=await response.json().catch(()=>({}))
  if(Number(result?.events_received)!==1)throw new Error('meta_capi_event_not_accepted')
  return {status:'sent',traceId:result.fbtrace_id||null}
}

export async function processMarketingOutbox(db,{send=sendMetaConversion,env=process.env}={}){
  const summary={marketingSent:0,marketingFailed:0,marketingDisabled:0}
  if(env.META_CAPI_ENABLED!=='true')return summary
  const {data:jobs,error}=await db.rpc('claim_marketing_event_outbox',{target_limit:10})
  if(error){if(error.code==='PGRST202'||error.code==='42883')return summary;throw error}
  for(const job of jobs||[]){
    try{
      const result=await send(job.payload)
      if(result.status==='disabled'){summary.marketingDisabled++;continue}
      await db.rpc('finish_marketing_event_outbox',{target_id:job.id,target_lease_token:job.lease_token,target_status:'sent',target_last_error:null});summary.marketingSent++
    }catch(error){await db.rpc('finish_marketing_event_outbox',{target_id:job.id,target_lease_token:job.lease_token,target_status:'failed',target_last_error:String(error?.message||'meta_delivery_failed').slice(0,200)});summary.marketingFailed++}
  }
  return summary
}

