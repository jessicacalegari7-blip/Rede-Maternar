import { createClient } from '@supabase/supabase-js'

function env(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  return value
}

export function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requireOrganization(req, { manager = false } = {}) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Não autenticado.'), { status: 401 })
  const db = adminClient()
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth.user) throw Object.assign(new Error('Sessão inválida.'), { status: 401 })
  const organizationId = req.headers['x-organization-id']
  if (!organizationId) throw Object.assign(new Error('Organização não informada.'), { status: 400 })
  const { data: membership } = await db.from('organization_members')
    .select('role').eq('organization_id', organizationId).eq('user_id', auth.user.id).maybeSingle()
  const { data: profile } = await db.from('profiles').select('is_platform_admin').eq('id', auth.user.id).maybeSingle()
  if (!membership && !profile?.is_platform_admin) throw Object.assign(new Error('Acesso negado.'), { status: 403 })
  if (manager && !profile?.is_platform_admin && !['owner', 'manager'].includes(membership?.role))
    throw Object.assign(new Error('Permissão de gestor necessária.'), { status: 403 })
  return { db, user: auth.user, organizationId, membership, isAdmin: Boolean(profile?.is_platform_admin) }
}

export async function requirePlatformAdmin(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) throw Object.assign(new Error('Não autenticado.'), { status: 401 })
  const db = adminClient()
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth.user) throw Object.assign(new Error('Sessão inválida.'), { status: 401 })
  const officialAdmin = String(auth.user.email || '').toLowerCase() === 'jessica.calegari7@gmail.com'
  const { data: profile } = await db.from('profiles').select('is_platform_admin').eq('id', auth.user.id).maybeSingle()
  if (!officialAdmin && !profile?.is_platform_admin) throw Object.assign(new Error('Acesso administrativo necessário.'), { status: 403 })
  if (officialAdmin && !profile?.is_platform_admin) await db.from('profiles').update({is_platform_admin:true,status:'active'}).eq('id',auth.user.id)
  return { db, user: auth.user }
}
