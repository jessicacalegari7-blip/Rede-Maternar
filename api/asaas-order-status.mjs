import {adminClient} from './_lib/supabase-admin.mjs'
import {allowMethods,json} from './_lib/http.mjs'

export default async function handler(req,res){
  if(!allowMethods(req,res,['GET']))return
  const token=String(req.query?.token||'')
  if(!/^[0-9a-f-]{36}$/i.test(token))return json(res,400,{error:'Identificador inválido.'})
  const {data,error}=await adminClient().from('premium_orders').select('status,product_name,amount_cents,paid_at,expires_at').eq('public_token',token).maybeSingle()
  if(error||!data)return json(res,404,{error:'Pedido não encontrado.'})
  return json(res,200,data)
}
