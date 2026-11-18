import {adminClient} from './supabase-admin.mjs'
import {allowMethods,json,readJson} from './http.mjs'
import {marketingUserData,queueMarketingEvent} from './meta-marketing.mjs'

const publicEvents=new Set(['PageView','ViewContent'])

export default async function marketingEventHandler(req,res){
  if(!allowMethods(req,res,['POST']))return
  if(process.env.META_MARKETING_COLLECTION_ENABLED!=='true')return json(res,404,{error:'Rota não encontrada.'})
  try{
    const body=await readJson(req),eventName=String(body.eventName||''),eventId=String(body.eventId||'')
    if(!publicEvents.has(eventName)||!/^[a-z0-9:_-]{12,180}$/i.test(eventId))return json(res,400,{error:'Evento inválido.'})
    if(body.attribution?.marketing_consent!==true)return json(res,204,{})
    await queueMarketingEvent(adminClient(),{eventId,eventName,sourceUrl:body.sourceUrl,customData:body.customData,attribution:body.attribution,consent:true,userData:marketingUserData({fbp:body.attribution?.fbp,fbc:body.attribution?.fbc,userAgent:req.headers['user-agent']})})
    return json(res,202,{ok:true})
  }catch(error){console.error('marketing_event_enqueue_failed',{code:error?.code||null});return json(res,202,{ok:true})}
}
