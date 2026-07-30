import type { User } from '@supabase/supabase-js'
import type { PublicUser, RegisterProfessionalInput, UserStatus } from './auth'
import type { ProfessionalPlan } from './plans'
import { isSupabaseConfigured, supabase } from './supabase'

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('A conexão segura ainda não foi configurada neste ambiente.')
  }
  return supabase
}

function normalizePlan(value: unknown): ProfessionalPlan {
  return ['free', 'marketplace', 'independent', 'clinic'].includes(String(value))
    ? (value as ProfessionalPlan)
    : 'free'
}

export async function getRemotePublicUser(authUser: User): Promise<PublicUser> {
  const client = requireSupabase()
  const [{ data: profile, error: profileError }, { data: memberships }, { data: patient }] = await Promise.all([
    client.from('profiles').select('full_name, phone, status, is_platform_admin').eq('id', authUser.id).single(),
    client.from('organization_members').select('role, organizations(plan, type)').eq('user_id', authUser.id).eq('active', true),
    client.from('patient_profiles').select('full_name, phone').eq('user_id', authUser.id).limit(1).maybeSingle(),
  ])
  if (profileError) throw new Error('Não foi possível carregar o perfil deste usuário.')

  const membership = memberships?.[0] as {
    role?: string
    organizations?: { plan?: string; type?: string } | Array<{ plan?: string; type?: string }>
  } | undefined
  const organization = Array.isArray(membership?.organizations)
    ? membership?.organizations[0]
    : membership?.organizations
  const role = profile.is_platform_admin ? 'admin' : membership ? 'professional' : patient ? 'patient' : 'professional'

  return {
    id: authUser.id,
    name: profile.full_name || patient?.full_name || authUser.email || 'Usuário',
    email: authUser.email || '',
    role,
    status: profile.status as UserStatus,
    createdAt: authUser.created_at,
    phone: profile.phone || patient?.phone || undefined,
    plan: role === 'professional' ? normalizePlan(organization?.plan) : undefined,
  }
}

export async function loginWithSupabase(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error || !data.user) throw new Error('E-mail ou senha incorretos.')

  const user = await getRemotePublicUser(data.user)
  if (user.status !== 'active') {
    await client.auth.signOut()
    if (user.status === 'pending') throw new Error('Seu cadastro ainda está aguardando aprovação.')
    if (user.status === 'suspended') throw new Error('Este acesso está suspenso. Fale com o suporte.')
    throw new Error('Este cadastro não foi aprovado.')
  }
  return user
}

export async function registerProfessionalWithSupabase(input: RegisterProfessionalInput) {
  const client = requireSupabase()
  const plan = normalizePlan(input.plan)
  const cityParts = input.city.split(',').map((part) => part.trim())
  const { data, error } = await client.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        account_type: 'professional',
        full_name: input.name.trim(),
        phone: input.phone.trim(),
        professional_registration: input.registration?.trim() || null,
        specialty: input.specialty,
        city: cityParts[0],
        state_code: (cityParts[1] || 'SP').slice(0, 2).toUpperCase(),
        plan,
        organization_name: input.name.trim(),
      },
    },
  })
  if (error || !data.user) {
    throw new Error(error?.message.includes('already') ? 'Já existe um cadastro com este e-mail.' : 'Não foi possível criar o acesso.')
  }
  if (data.session) await client.auth.signOut()
  return { needsEmailConfirmation: !data.session }
}
