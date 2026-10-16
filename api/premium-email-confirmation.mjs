import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json,readJson} from './_lib/http.mjs'
import {resendPremiumConfirmationEmail} from './_lib/premium-email.mjs'

export default async function handler(req,res){
  if(!allowMethods(req,res,['POST']))return
  try{
    const {token}=await readJson(req)
    if(!/^[0-9a-f-]{36}$/i.test(String(token||'')))return json(res,400,{error:'Identificador inválido.'})
    const db=adminClient()
    const {data:order,error}=await db.from('premium_orders').select('id,user_id,status').eq('public_token',token).maybeSingle()
    if(error||!order||order.status!=='paid')return json(res,404,{error:'Pagamento confirmado não encontrado.'})
    const status=await resendPremiumConfirmationEmail(db,{userId:order.user_id,orderId:order.id})
    if(status==='rate_limited')return json(res,429,{error:'Aguarde alguns minutos antes de solicitar um novo envio.'})
    if(status==='already_confirmed')return json(res,200,{ok:true,status,message:'Seu e-mail já está confirmado.'})
    if(status!=='sent')return json(res,503,{error:'Não foi possível enviar agora. Tente novamente em alguns minutos.'})
    return json(res,200,{ok:true,status,message:'E-mail de confirmação reenviado. Confira também a pasta de spam.'})
  }catch{return json(res,500,{error:'Não foi possível reenviar a confirmação agora.'})}
}
