import crypto from 'node:crypto'
import { allowMethods,json,readJson } from '../_lib/http.mjs'
import { adminClient } from '../_lib/supabase-admin.mjs'
import { normalizePhone } from '../_lib/evolution.mjs'

function sameHash(secret,expected){const actual=crypto.createHash('sha256').update(secret).digest('hex');const a=Buffer.from(actual);const b=Buffer.from(expected||'');return a.length===b.length&&crypto.timingSafeEqual(a,b)}
function eventName(payload){return String(payload.event||payload.type||'unknown').toUpperCase().replace(/[.-]/g,'_')}

export default async function handler(req,res){
  if(!allowMethods(req,res,['POST']))return
  try{
    const db=adminClient(); const connectionId=String(req.query?.connection||''); const secret=String(req.query?.secret||'')
    const {data:connection,error}=await db.from('whatsapp_connections').select('*').eq('id',connectionId).single()
    if(error||!connection||!sameHash(secret,connection.webhook_secret_hash))return json(res,401,{error:'Webhook não autorizado.'})
    const payload=await readJson(req); const event=eventName(payload); const data=payload.data||payload
    const key=String(data?.key?.id||data?.messageId||`${event}:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`)
    const inserted=await db.from('evolution_webhook_events').insert({connection_id:connection.id,event_key:key,event_type:event,payload}).select('id').maybeSingle()
    if(inserted.error?.code==='23505')return json(res,200,{ok:true,duplicate:true})
    if(inserted.error)throw inserted.error
    try{
      if(event.includes('CONNECTION_UPDATE')){
        const state=String(data?.state||data?.status||'').toLowerCase();const status=state==='open'||state==='connected'?'connected':state==='connecting'?'connecting':state==='close'||state==='disconnected'?'disconnected':'error'
        await db.from('whatsapp_connections').update({status,last_seen_at:new Date().toISOString(),connected_at:status==='connected'?new Date().toISOString():connection.connected_at,last_error:status==='error'?JSON.stringify(data):null}).eq('id',connection.id)
      }
      if(event.includes('MESSAGES_UPSERT')){
        const remote=String(data?.key?.remoteJid||data?.remoteJid||''); if(!remote.endsWith('@g.us')){
          const phone=normalizePhone(remote.split('@')[0]);const outbound=Boolean(data?.key?.fromMe);const body=String(data?.message?.conversation||data?.message?.extendedTextMessage?.text||data?.message?.imageMessage?.caption||data?.body||'[Mensagem sem texto]')
          let {data:contact}=await db.from('contacts').select('*').eq('organization_id',connection.organization_id).eq('phone_normalized',phone).maybeSingle()
          if(!contact){const created=await db.from('contacts').insert({organization_id:connection.organization_id,full_name:data?.pushName||phone,phone,phone_normalized:phone,source:'whatsapp_evolution'}).select('*').single();if(created.error)throw created.error;contact=created.data}
          let {data:conversation}=await db.from('conversations').select('*').eq('whatsapp_connection_id',connection.id).eq('external_chat_id',remote).maybeSingle()
          if(!conversation){const created=await db.from('conversations').insert({organization_id:connection.organization_id,whatsapp_connection_id:connection.id,contact_id:contact.id,channel:'whatsapp_evolution',external_chat_id:remote,contact_name:contact.full_name,contact_phone:phone,unread_count:outbound?0:1,last_message_at:new Date().toISOString()}).select('*').single();if(created.error)throw created.error;conversation=created.data}
          const message=await db.from('conversation_messages').upsert({organization_id:connection.organization_id,conversation_id:conversation.id,whatsapp_connection_id:connection.id,direction:outbound?'outbound':'inbound',body,status:outbound?'sent':'delivered',external_message_id:data?.key?.id||null,raw_payload:payload,sent_at:outbound?new Date().toISOString():null},{onConflict:'whatsapp_connection_id,external_message_id',ignoreDuplicates:true})
          if(message.error)throw message.error
          await db.from('conversations').update({last_message_at:new Date().toISOString(),unread_count:outbound?conversation.unread_count:(conversation.unread_count||0)+1}).eq('id',conversation.id)
          if(!outbound&&!conversation.lead_id){const lead=await db.from('leads').insert({organization_id:connection.organization_id,full_name:contact.full_name,phone,source:'whatsapp_evolution',status:'new',last_message_at:new Date().toISOString(),unread_messages:1}).select('id').single();if(!lead.error)await db.from('conversations').update({lead_id:lead.data.id}).eq('id',conversation.id)}
        }
      }
      await db.from('evolution_webhook_events').update({processed_at:new Date().toISOString()}).eq('id',inserted.data.id)
      json(res,200,{ok:true})
    }catch(processError){await db.from('evolution_webhook_events').update({error_message:processError.message}).eq('id',inserted.data.id);throw processError}
  }catch(error){json(res,500,{error:error.message})}
}
