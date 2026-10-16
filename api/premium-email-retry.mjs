import {adminClient} from './_lib/supabase-admin.mjs'
import {json} from './_lib/http.mjs'
import {deliverPremiumActivationEmail} from './_lib/premium-email.mjs'
import {safeEqual} from './_lib/asaas.mjs'

export default async function handler(req,res){
  const expected=process.env.CRON_SECRET?.trim(),received=req.headers.authorization?.replace(/^Bearer\s+/i,'')
  if(!expected||!safeEqual(received,expected))return json(res,401,{error:'Não autorizado.'})
  const db=adminClient()
  const stale=new Date(Date.now()-10*60*1000).toISOString()
  const {data,error}=await db.from('admin_email_notifications').select('payload,status,updated_at').eq('event_type','premium_activated').lt('attempts',5).or(`status.in.(pending,failed),and(status.eq.processing,updated_at.lt.${stale})`).order('created_at').limit(20)
  if(error)return json(res,500,{error:'Não foi possível consultar a fila.'})
  const results=[]
  for(const row of data||[]){const userId=row.payload?.user_id,orderId=row.payload?.order_id;if(userId&&orderId)results.push(await deliverPremiumActivationEmail(db,{userId,orderId}))}
  return json(res,200,{ok:true,processed:results.length,sent:results.filter(item=>item==='sent').length})
}
