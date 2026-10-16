import {requirePlatformAdmin} from './supabase-admin.mjs'
import {allowMethods,json,readJson} from './http.mjs'
import {eventFields} from './asaas.mjs'

export default async function handler(req,res){
  if(!allowMethods(req,res,['GET','POST']))return
  try{
    const {db}=await requirePlatformAdmin(req)
    if(req.method==='POST'){
      const {eventId}=await readJson(req)
      const {data:event,error:eventError}=await db.from('asaas_webhook_events').select('*').eq('id',String(eventId||'')).single()
      if(eventError||!event)return json(res,404,{error:'Evento não encontrado.'})
      const fields=eventFields(event.payload)
      const {data:result,error:rpcError}=await db.rpc('process_asaas_webhook_event',{
        target_event_id:event.id,target_event_type:fields.eventType,target_checkout_id:fields.checkoutId,
        target_payment_id:fields.paymentId,target_external_reference:fields.externalReference,
        target_amount_cents:fields.amountCents,target_payload:event.payload,
      })
      if(rpcError)throw rpcError
      if(!result?.ok)throw new Error('Evento não pôde ser reprocessado com segurança.')
      return json(res,200,{ok:true,result})
    }
    const search=String(req.query?.search||'').trim(),status=String(req.query?.status||'').trim()
    let query=db.from('premium_orders').select('id,user_id,organization_id,professional_id,customer_name,customer_email,product_name,amount_cents,status,asaas_checkout_id,asaas_payment_id,paid_at,expires_at,created_at')
      .order('created_at',{ascending:false}).limit(200)
    if(status)query=query.eq('status',status)
    if(search){const clean=search.replace(/[%_,]/g,'');query=query.or(`id.eq.${/^[0-9a-f-]{36}$/i.test(clean)?clean:'00000000-0000-0000-0000-000000000000'},asaas_checkout_id.ilike.%${clean}%,customer_name.ilike.%${clean}%,customer_email.ilike.%${clean}%`)}
    const [{data:orders,error:ordersError},{data:events,error:eventsError}]=await Promise.all([query,db.from('asaas_webhook_events').select('id,event_type,checkout_id,processing_status,attempts,last_error,received_at,processed_at').in('processing_status',['received','error']).order('received_at',{ascending:false}).limit(100)])
    if(ordersError)throw ordersError;if(eventsError)throw eventsError
    const rows=orders||[],now=Date.now(),summary={sales:rows.length,grossCents:rows.filter(x=>x.status==='paid').reduce((sum,x)=>sum+x.amount_cents,0),pending:rows.filter(x=>x.status==='pending').length,paid:rows.filter(x=>x.status==='paid').length,refunded:rows.filter(x=>['refunded','chargeback'].includes(x.status)).length,expiring:0,failures:(events||[]).filter(x=>x.processing_status==='error').length}
    const {count:activeContracts}=await db.from('premium_contracts').select('id',{head:true,count:'exact'}).eq('status','active')
    const {count:awaitingCompletion}=await db.from('premium_contracts').select('id',{head:true,count:'exact'}).eq('publication_status','awaiting_completion')
    const {count:awaitingApproval}=await db.from('premium_contracts').select('id',{head:true,count:'exact'}).eq('publication_status','awaiting_approval')
    const {count:published}=await db.from('premium_contracts').select('id',{head:true,count:'exact'}).eq('publication_status','published')
    const {count:expiring}=await db.from('premium_contracts').select('id',{head:true,count:'exact'}).eq('status','active').gte('valid_until',new Date(now).toISOString()).lte('valid_until',new Date(now+30*86400000).toISOString())
    return json(res,200,{summary:{...summary,activeContracts:activeContracts||0,awaitingCompletion:awaitingCompletion||0,awaitingApproval:awaitingApproval||0,published:published||0,expiring:expiring||0},orders:rows,events:events||[]})
  }catch(error){return json(res,error.status||500,{error:error instanceof Error?error.message:'Falha ao consultar integração Asaas.'})}
}
