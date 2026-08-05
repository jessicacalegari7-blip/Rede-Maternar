import type { UserStatus } from './auth'
import { isSupabaseConfigured, supabase } from './supabase'

export interface AdminProfessional {
  userId: string
  professionalProfileId: string
  organizationId: string
  fullName: string
  email: string
  phone: string
  specialty: string
  city: string
  stateCode: string
  organizationName: string
  organizationType: 'independent' | 'clinic'
  plan: 'free' | 'marketplace' | 'independent' | 'clinic'
  status: UserStatus
  marketplaceVisible: boolean
  verified: boolean
  createdAt: string
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('O Supabase não está configurado neste ambiente.')
  return supabase
}

export async function listAdminProfessionals(): Promise<AdminProfessional[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_professionals')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    userId: String(row.user_id),
    professionalProfileId: String(row.professional_profile_id),
    organizationId: String(row.organization_id),
    fullName: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    specialty: String(row.specialty ?? 'Especialidade não informada'),
    city: String(row.city ?? ''),
    stateCode: String(row.state_code ?? ''),
    organizationName: String(row.organization_name ?? ''),
    organizationType: row.organization_type === 'clinic' ? 'clinic' : 'independent',
    plan: String(row.plan ?? 'free') as AdminProfessional['plan'],
    status: String(row.status ?? 'pending') as UserStatus,
    marketplaceVisible: Boolean(row.marketplace_visible),
    verified: Boolean(row.verified),
    createdAt: String(row.created_at),
  }))
}

export async function setAdminProfessionalStatus(userId: string, status: UserStatus) {
  const { error } = await requireSupabase().rpc('admin_set_professional_status', {
    target_user_id: userId,
    new_status: status,
  })
  if (error) throw new Error(error.message)
}
