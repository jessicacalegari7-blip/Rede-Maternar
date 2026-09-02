import { requirePlatformAdmin } from './_lib/supabase-admin.mjs'

const json=(res,status,body)=>res.status(status).json(body)

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'Método não permitido.'})
  try{
    const {db,user}=await requirePlatformAdmin(req)
    const userId=String(req.body?.userId||'')
    const status=String(req.body?.status||'')
    if(!userId||!['active','pending','suspended','rejected'].includes(status))return json(res,400,{error:'Dados de aprovação inválidos.'})
    const {data:member}=await db.from('organization_members').select('organization_id').eq('user_id',userId).eq('active',true).order('created_at').limit(1).maybeSingle()
    const organizationId=member?.organization_id
    if(status==='active'){
      const {error:authError}=await db.auth.admin.updateUserById(userId,{email_confirm:true})
      if(authError)throw authError
    }
    const {error:profileError}=await db.from('profiles').update({status,updated_at:new Date().toISOString()}).eq('id',userId)
    if(profileError)throw profileError
    if(organizationId){
      const {error:organizationError}=await db.from('organizations').update({status,updated_at:new Date().toISOString()}).eq('id',organizationId);if(organizationError)throw organizationError
      const {error:professionalError}=await db.from('professional_profiles').update({marketplace_visible:status==='active',updated_at:new Date().toISOString()}).eq('organization_id',organizationId);if(professionalError)throw professionalError
    }
    const {data:target}=await db.auth.admin.getUserById(userId)
    const email=target?.user?.email
    let emailSent=false
    if(status==='active'&&email){
      await db.from('admin_email_notifications').insert({event_type:'professional_approved',recipient:email,subject:'Seu cadastro foi aprovado na MaterPlace',payload:{user_id:userId,full_name:target.user.user_metadata?.full_name||'',email}})
    }
    if(status==='active'&&email&&process.env.RESEND_API_KEY&&process.env.ADMIN_NOTIFICATION_FROM_EMAIL){
      const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.ADMIN_NOTIFICATION_FROM_EMAIL,to:[email],subject:'Seu cadastro foi aprovado na MaterPlace',html:`<h1>Cadastro aprovado</h1><p>Olá! Seu cadastro profissional foi aprovado na MaterPlace.</p><p>Você já pode entrar com o mesmo e-mail e a senha criada no cadastro.</p><p><a href="https://www.materplace.com.br/login">Entrar na MaterPlace</a></p>`})})
      emailSent=mail.ok
    }
    await db.from('audit_logs').insert({actor_id:user.id,organization_id:organizationId||null,action:'professional_status_changed',entity_type:'profile',entity_id:userId,metadata:{new_status:status,email_sent:emailSent}})
    return json(res,200,{ok:true,emailSent,emailQueued:status==='active'&&Boolean(email)})
  }catch(error){return json(res,error.status||500,{error:error instanceof Error?error.message:'Falha ao aprovar cadastro.'})}
}
