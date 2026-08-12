import crypto from 'node:crypto'
import { allowMethods,json,readJson } from '../_lib/http.mjs'
import { requireOrganization } from '../_lib/supabase-admin.mjs'
import { evolution } from '../_lib/evolution.mjs'

export default async function handler(req,res){
  if(!allowMethods(req,res,['GET','POST']))return
  try{
    const {db,user,organizationId}=await requireOrganization(req,{manager:req.method==='POST'})
    if(req.method==='GET'){
      const {data,error}=await db.from('whatsapp_connections').select('id,instance_name,phone_number,status,connected_at,last_error,last_seen_at,created_at').eq('organization_id',organizationId).order('created_at')
      if(error)throw error; return json(res,200,{instances:data||[]})
    }
    const input=await readJson(req); const suffix=crypto.randomBytes(3).toString('hex')
    const instanceName=String(input.instanceName||`materplace-${organizationId.slice(0,8)}-${suffix}`).replace(/[^a-zA-Z0-9_-]/g,'-')
    const secret=crypto.randomBytes(32).toString('hex'); const hash=crypto.createHash('sha256').update(secret).digest('hex')
    const {data:connection,error}=await db.from('whatsapp_connections').insert({organization_id:organizationId,provider:'evolution',instance_name:instanceName,status:'connecting',created_by:user.id,webhook_secret_hash:hash}).select('*').single()
    if(error)throw error
    const webhookBase=(process.env.PUBLIC_APP_URL||'').replace(/\/$/,'')
    if(!webhookBase)throw Object.assign(new Error('PUBLIC_APP_URL não configurada.'),{status:503})
    try{
      const created=await evolution('/instance/create',{method:'POST',body:{instanceName,qrcode:true,integration:'WHATSAPP-BAILEYS',webhook:{url:`${webhookBase}/api/evolution/webhook?connection=${connection.id}&secret=${secret}`,byEvents:false,base64:true,events:['QRCODE_UPDATED','CONNECTION_UPDATE','MESSAGES_UPSERT','MESSAGES_UPDATE']}}})
      await db.from('whatsapp_connections').update({external_instance_id:created?.instance?.instanceId||created?.instance?.instanceName||instanceName,metadata:created}).eq('id',connection.id)
      return json(res,201,{instance:{...connection,external_instance_id:created?.instance?.instanceId||instanceName},provider:created})
    }catch(error){await db.from('whatsapp_connections').update({status:'error',last_error:error.message}).eq('id',connection.id);throw error}
  }catch(error){json(res,error.status||500,{error:error.message,details:error.details})}
}
