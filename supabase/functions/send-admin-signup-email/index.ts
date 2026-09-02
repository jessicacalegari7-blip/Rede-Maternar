import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Content-Type': 'application/json' }

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers })
  }

  const expectedSecret = Deno.env.get('SIGNUP_WEBHOOK_SECRET')
  if (!expectedSecret || request.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('ADMIN_NOTIFICATION_FROM_EMAIL')
  if (!supabaseUrl || !serviceRoleKey || !resendKey || !fromEmail) {
    return new Response(JSON.stringify({ error: 'Configuração de e-mail incompleta' }), { status: 500, headers })
  }

  const webhook = await request.json()
  const notificationId = webhook.record?.id ?? webhook.id
  if (!notificationId) {
    return new Response(JSON.stringify({ error: 'Notificação inválida' }), { status: 400, headers })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: notification, error } = await supabase
    .from('admin_email_notifications')
    .select('*')
    .eq('id', notificationId)
    .single()

  if (error || !notification) {
    return new Response(JSON.stringify({ error: 'Notificação não encontrada' }), { status: 404, headers })
  }
  if (notification.status === 'sent') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { headers })
  }

  await supabase.from('admin_email_notifications').update({
    status: 'processing',
    attempts: notification.attempts + 1,
    last_error: null,
  }).eq('id', notification.id)

  const profile = notification.payload
  const isApproval = notification.event_type === 'professional_approved'
  const html = isApproval ? `
    <h1>Cadastro aprovado</h1>
    <p>Olá${profile.full_name ? `, ${profile.full_name}` : ''}! Seu cadastro profissional foi aprovado na MaterPlace.</p>
    <p>Você já pode entrar com o mesmo e-mail e a senha criada no cadastro.</p>
    <p><a href="https://www.materplace.com.br/login">Entrar na MaterPlace</a></p>
  ` : `
    <h1>Novo cadastro profissional</h1>
    <p>Um novo cadastro foi recebido na Rede Maternar.</p>
    <ul>
      <li><strong>Nome:</strong> ${profile.full_name ?? 'Não informado'}</li>
      <li><strong>E-mail:</strong> ${profile.email ?? 'Não informado'}</li>
      <li><strong>WhatsApp:</strong> ${profile.whatsapp ?? 'Não informado'}</li>
      <li><strong>Clínica/organização:</strong> ${profile.organization_name ?? 'Não informada'}</li>
      <li><strong>Plano:</strong> ${profile.plan ?? 'Não informado'}</li>
      <li><strong>Localização:</strong> ${profile.city ?? 'Não informada'} - ${profile.state_code ?? ''}</li>
    </ul>
    <p>Acesse o painel administrativo da Rede Maternar para analisar o cadastro.</p>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [notification.recipient],
      subject: notification.subject,
      html,
    }),
  })

  if (!response.ok) {
    const lastError = await response.text()
    await supabase.from('admin_email_notifications')
      .update({ status: 'failed', last_error: lastError }).eq('id', notification.id)
    return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail' }), { status: 502, headers })
  }

  await supabase.from('admin_email_notifications').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    last_error: null,
  }).eq('id', notification.id)

  return new Response(JSON.stringify({ ok: true }), { headers })
})
