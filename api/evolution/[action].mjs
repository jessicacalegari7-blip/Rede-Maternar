import { allowMethods, json, readJson } from '../_lib/http.mjs'
import { requireOrganization } from '../_lib/supabase-admin.mjs'
import { evolution, normalizePhone } from '../_lib/evolution.mjs'

async function qrcode(req,res){
  if(!allowMethods(req,res,['GET']))return
  try{
    const {db,organizationId}=await requireOrganization(req,{manager:true})
    const id=String(req.query?.id||'')
    const {data:c,error}=await db.from('whatsapp_connections').select('*').eq('id',id).eq('organization_id',organizationId).single()
    if(error)throw Object.assign(new Error('Instância não encontrada.'),{status:404})
    const qr=await evolution(`/instance/connect/${encodeURIComponent(c.instance_name)}`)
    json(res,200,{code:qr?.base64||qr?.qrcode?.base64||qr?.code||null,pairingCode:qr?.pairingCode||null,raw:qr})
  }catch(error){json(res,error.status||500,{error:error.message})}
}

async function status(req,res){
  if(!allowMethods(req,res,['GET']))return
  try{
    const {db,organizationId}=await requireOrganization(req)
    const id=String(req.query?.id||'')
    const {data:c,error}=await db.from('whatsapp_connections').select('*').eq('id',id).eq('organization_id',organizationId).single()
    if(error)throw Object.assign(new Error('Instância não encontrada.'),{status:404})
    const state=await evolution(`/instance/connectionState/${encodeURIComponent(c.instance_name)}`)
    const raw=state?.instance?.state||state?.state||'disconnected'
    const connectionStatus=raw==='open'||raw==='connected'?'connected':raw==='connecting'?'connecting':'disconnected'
    await db.from('whatsapp_connections').update({status:connectionStatus,last_seen_at:new Date().toISOString(),connected_at:connectionStatus==='connected'?(c.connected_at||new Date().toISOString()):c.connected_at,last_error:null}).eq('id',c.id)
    json(res,200,{status:connectionStatus,provider:state})
  }catch(error){json(res,error.status||500,{error:error.message})}
}

async function send(req,res){
  if(!allowMethods(req,res,['POST']))return
  try{
    const {db,user,organizationId}=await requireOrganization(req)
    const input=await readJson(req)
    const body=String(input.body||'').trim()
    if(!body)throw Object.assign(new Error('Mensagem vazia.'),{status:400})
    const {data:conversation,error:ce}=await db.from('conversations').select('*').eq('id',input.conversationId).eq('organization_id',organizationId).single()
    if(ce)throw Object.assign(new Error('Conversa não encontrada.'),{status:404})
    const {data:connection,error:we}=await db.from('whatsapp_connections').select('*').eq('id',input.connectionId||conversation.whatsapp_connection_id).eq('organization_id',organizationId).eq('status','connected').single()
    if(we)throw Object.assign(new Error('WhatsApp não está conectado.'),{status:409})
    const {data:message,error:me}=await db.from('conversation_messages').insert({organization_id:organizationId,conversation_id:conversation.id,whatsapp_connection_id:connection.id,sender_user_id:user.id,direction:'outbound',body,status:'queued'}).select('*').single()
    if(me)throw me
    try{
      const provider=await evolution(`/message/sendText/${encodeURIComponent(connection.instance_name)}`,{method:'POST',body:{number:normalizePhone(conversation.contact_phone),text:body}})
      const external=provider?.key?.id||provider?.message?.key?.id||null
      await db.from('conversation_messages').update({status:'sent',sent_at:new Date().toISOString(),external_message_id:external,raw_payload:provider}).eq('id',message.id)
      await db.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',conversation.id)
      json(res,200,{message:{...message,status:'sent',external_message_id:external}})
    }catch(error){
      await db.from('conversation_messages').update({status:'failed',error_message:error.message}).eq('id',message.id)
      throw error
    }
  }catch(error){json(res,error.status||500,{error:error.message})}
}

const handlers={qrcode,status,send}

export default async function handler(req,res){
  const action=String(req.query?.action||'')
  const selected=handlers[action]
  if(!selected)return json(res,404,{error:'Ação não encontrada.'})
  return selected(req,res)
}
