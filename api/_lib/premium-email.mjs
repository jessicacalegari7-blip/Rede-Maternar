import {createHash,randomBytes} from 'node:crypto'

const siteUrl=()=>String(process.env.PUBLIC_SITE_URL||process.env.PUBLIC_APP_URL||'https://www.materplace.com.br').replace(/\/$/,'')
const sender={name:'MaterPlace — Diretório Profissional',email:'diretorio@materplace.com.br'}
const supportUrl='https://wa.me/5511930078750?text=Ol%C3%A1%21%20Preciso%20de%20ajuda%20com%20meu%20cadastro%20na%20MaterPlace.'

const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))
const supportHtml=()=>`<div style="margin-top:28px;padding:20px;background:#f3f7f5;border:1px solid #dce8e2;border-radius:12px"><p style="margin:0 0 8px;font-weight:700;color:#0D2B23">Precisa de ajuda?</p><p style="margin:0 0 12px;line-height:1.55">Nossa equipe está à disposição para esclarecer qualquer dúvida sobre seu cadastro ou acesso à MaterPlace.</p><p style="margin:0 0 16px"><strong>WhatsApp do suporte: <a href="${escapeHtml(supportUrl)}" style="color:#0D2B23">(11) 93007-8750</a></strong></p><a href="${escapeHtml(supportUrl)}" style="display:inline-block;background:#0D2B23;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Falar com o suporte</a></div>`
const supportText=()=>`Precisa de ajuda?\n\nNossa equipe está à disposição para esclarecer qualquer dúvida sobre seu cadastro ou acesso à MaterPlace.\n\nWhatsApp do suporte: (11) 93007-8750\nFalar com o suporte: ${supportUrl}`

async function confirmationLink(db,user){
  if(user.email_confirmed_at)return `${siteUrl()}/login`
  const {data,error}=await db.auth.admin.generateLink({type:'magiclink',email:user.email,options:{redirectTo:`${siteUrl()}/profissional/perfil`}})
  if(error||!data?.properties?.action_link)throw error||new Error('Não foi possível gerar o link seguro de confirmação.')
  return data.properties.action_link
}

async function brevoSend(payload){
  const key=process.env.BREVO_API_KEY?.trim()
  if(!key)throw new Error('BREVO_API_KEY não configurada.')
  let lastError
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':key,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)})
      if(response.ok){const body=await response.json().catch(()=>({}));return String(body.messageId||'accepted')}
      const retryable=response.status===429||response.status>=500
      lastError=new Error(`Brevo respondeu HTTP ${response.status}`)
      if(!retryable)break
    }catch(error){lastError=error instanceof Error?error:new Error('Falha de rede no envio pelo Brevo.')}
    if(attempt<3)await wait(250*2**(attempt-1))
  }
  throw lastError||new Error('O Brevo não confirmou o envio.')
}

export const createPremiumInviteToken=()=>randomBytes(32).toString('base64url')
export const hashPremiumInviteToken=token=>createHash('sha256').update(String(token)).digest('hex')

function inviteHtml(name,link){
  return `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f3ed;font-family:Arial,sans-serif;color:#0d2b23"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e8dfd2;border-radius:18px;padding:32px"><p style="margin:0 0 22px;color:#9b7518;font-weight:700;letter-spacing:.08em">MATERPLACE</p><h1 style="margin:0 0 22px;font-size:25px;line-height:1.25">Pagamento confirmado!</h1><p>Olá, ${escapeHtml(name||'profissional')}.</p><p>Recebemos a confirmação do pagamento de <strong>R$ 59,99</strong> referente à contratação do Perfil Premium MaterPlace, com validade de <strong>12 meses</strong>.</p><p><strong>Seu acesso está liberado!</strong></p><p>Para começar, clique no botão abaixo e crie sua senha de acesso à plataforma.</p><p style="margin:28px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0d2b23;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">CRIAR MINHA SENHA</a></p><p>Após criar sua senha, você poderá acessar o painel e preencher as informações do seu perfil profissional.</p><p>Seu perfil será publicado no diretório após o preenchimento completo e a validação dos dados obrigatórios.</p><p style="font-size:13px;color:#56745f">Se você não realizou essa contratação, entre em contato com a MaterPlace.</p>${supportHtml()}<p style="margin-top:24px">Atenciosamente,<br><strong>Equipe MaterPlace</strong></p></div></div></body></html>`
}

function inviteText(name,link){
  return `Pagamento confirmado!\n\nOlá, ${String(name||'profissional')}.\n\nRecebemos a confirmação do pagamento de R$ 59,99 referente à contratação do Perfil Premium MaterPlace, com validade de 12 meses.\n\nSeu acesso está liberado!\n\nCrie sua senha de acesso à plataforma pelo link seguro abaixo:\n${link}\n\nApós criar sua senha, você poderá acessar o painel e preencher as informações do seu perfil profissional. Seu perfil será publicado no diretório após o preenchimento completo e a validação dos dados obrigatórios.\n\nSe você não realizou essa contratação, entre em contato com a MaterPlace.\n\n${supportText()}\n\nAtenciosamente,\nEquipe MaterPlace`
}

export async function deliverPremiumAccessInvite(db,{orderId,force=false,idempotencyKey,traceId}){
  if(!orderId)return 'not_applicable'
  const token=createPremiumInviteToken(),tokenHash=hashPremiumInviteToken(token)
  const {data:invite,error}=await db.rpc('issue_premium_access_invite',{target_order_id:orderId,target_token_hash:tokenHash,target_force:force})
  if(error)throw error
  if(!invite?.should_send)return invite?.status||'already_sent'
  const link=`${siteUrl()}/convite-premium?token=${encodeURIComponent(token)}`
  let providerId
  try{
    providerId=await brevoSend({sender,to:[{email:invite.email,name:invite.name||undefined}],subject:'MaterPlace | Pagamento confirmado — Crie sua senha',htmlContent:inviteHtml(invite.name,link),textContent:inviteText(invite.name,link),headers:{...(idempotencyKey?{IdempotencyKey:String(idempotencyKey)}:{}),...(traceId?{'X-Mailin-custom':'premium-outbox:'+String(traceId)}:{})}})
  }catch(error){
    await db.rpc('finish_premium_access_invite_email',{target_invite_id:invite.invite_id,target_status:'failed',target_last_error:String(error instanceof Error?error.message:error).slice(0,500),target_provider_id:null})
    return 'failed'
  }
  const {error:finishError}=await db.rpc('finish_premium_access_invite_email',{target_invite_id:invite.invite_id,target_status:'sent',target_last_error:null,target_provider_id:providerId})
  return finishError?'delivery_uncertain':'sent'
}

function activationHtml(name,link,needsConfirmation){
  const safeName=escapeHtml(name||'profissional')
  const safeLink=escapeHtml(link)
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f3ed;font-family:Arial,sans-serif;color:#0d2b23"><div style="max-width:620px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e8dfd2;border-radius:18px;padding:32px"><p style="color:#9b7518;font-weight:700">MATERPLACE</p><h1 style="font-size:25px">Pagamento aprovado</h1><p>Olá, ${safeName}.</p><p>Confirmamos o pagamento de <strong>R$ 59,99</strong> e a contratação do <strong>Perfil Premium MaterPlace por 12 meses</strong>.</p><p>Seu acesso à plataforma está liberado. ${needsConfirmation?'Confirme seu endereço de e-mail no botão abaixo e, em seguida, complete seu cadastro profissional.':'Você já pode completar seu cadastro profissional.'}</p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#0d2b23;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Completar meu cadastro</a></p><p>O perfil será publicado automaticamente somente após a conclusão e validação dos dados obrigatórios. Dados incompletos ou inconsistentes permanecem privados para revisão.</p><p style="font-size:13px;color:#56745f">Por segurança, a MaterPlace nunca envia senhas por e-mail.</p>${supportHtml()}</div></div></body></html>`
}

function activationText(name,link,needsConfirmation){
  return `Pagamento aprovado\n\nOlá, ${String(name||'profissional')}.\n\nConfirmamos o pagamento de R$ 59,99 e a contratação do Perfil Premium MaterPlace por 12 meses.\n\nSeu acesso à plataforma está liberado. ${needsConfirmation?'Confirme seu endereço de e-mail pelo link abaixo e, em seguida, complete seu cadastro profissional.':'Você já pode completar seu cadastro profissional.'}\n\nCompletar meu cadastro: ${link}\n\nO perfil será publicado automaticamente somente após a conclusão e validação dos dados obrigatórios.\n\nPor segurança, a MaterPlace nunca envia senhas por e-mail.\n\n${supportText()}`
}

export async function deliverPremiumActivationEmail(db,{userId,orderId}){
  if(!userId||!orderId)return 'not_applicable'
  const {data:claim,error:claimError}=await db.rpc('claim_premium_activation_email',{target_user_id:userId,target_order_id:orderId})
  if(claimError)throw claimError
  if(!claim?.should_send)return claim?.status==='sent'?'already_sent':'already_processing'
  try{
    const {data:userData,error:userError}=await db.auth.admin.getUserById(userId)
    const user=userData?.user
    if(userError||!user?.email)throw userError||new Error('Destinatário não encontrado.')
    const link=await confirmationLink(db,user)
    const needsConfirmation=!user.email_confirmed_at
    const providerId=await brevoSend({sender,to:[{email:user.email,name:user.user_metadata?.full_name||undefined}],subject:'Pagamento aprovado — Seu Perfil Premium MaterPlace está liberado!',htmlContent:activationHtml(user.user_metadata?.full_name,link,needsConfirmation),textContent:activationText(user.user_metadata?.full_name,link,needsConfirmation)})
    const {error:finishError}=await db.rpc('finish_premium_activation_email',{target_notification_id:claim.notification_id,target_status:'sent',target_last_error:null,target_provider_id:providerId})
    if(finishError)throw finishError
    return 'sent'
  }catch(error){
    const message=String(error instanceof Error?error.message:error).slice(0,500)
    await db.rpc('finish_premium_activation_email',{target_notification_id:claim.notification_id,target_status:'failed',target_last_error:message,target_provider_id:null})
    return 'failed'
  }
}

export async function resendPremiumConfirmationEmail(db,{userId,orderId}){
  let claim
  try{
    const {data:userData,error:userError}=await db.auth.admin.getUserById(userId)
    const user=userData?.user
    if(userError||!user?.email)throw userError||new Error('Destinatário não encontrado.')
    if(user.email_confirmed_at)return 'already_confirmed'
    const {data,error}=await db.rpc('claim_premium_confirmation_resend',{target_user_id:userId,target_order_id:orderId})
    claim=data
    if(error)throw error
    if(!claim?.should_send)return claim?.status==='rate_limited'?'rate_limited':'already_processing'
    const link=await confirmationLink(db,user)
    const providerId=await brevoSend({sender,to:[{email:user.email,name:user.user_metadata?.full_name||undefined}],subject:'Confirme seu e-mail — MaterPlace',htmlContent:activationHtml(user.user_metadata?.full_name,link,true),textContent:activationText(user.user_metadata?.full_name,link,true)})
    await db.rpc('finish_premium_activation_email',{target_notification_id:claim.notification_id,target_status:'sent',target_last_error:null,target_provider_id:providerId})
    return 'sent'
  }catch(sendError){
    if(claim?.notification_id)await db.rpc('finish_premium_activation_email',{target_notification_id:claim.notification_id,target_status:'failed',target_last_error:String(sendError instanceof Error?sendError.message:sendError).slice(0,500),target_provider_id:null})
    return 'failed'
  }
}
