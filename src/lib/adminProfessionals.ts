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
  viewCount: number
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) throw new Error('O Supabase não está configurado neste ambiente.')
  return supabase
}

export async function listAdminProfessionals(): Promise<AdminProfessional[]> {
  const db=requireSupabase()
  const [{data,error},{data:views,error:viewsError}]=await Promise.all([db.rpc('admin_list_professionals'),db.rpc('admin_list_profile_views')])
  if (error) throw new Error(error.message)
  if (viewsError) throw new Error(viewsError.message)
  const counts=new Map((views??[]).map((item:Record<string,unknown>)=>[String(item.professional_id),Number(item.view_count??0)]))
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
    viewCount: counts.get(String(row.professional_profile_id))??0,
  }))
}

export async function setAdminProfessionalStatus(userId: string, status: UserStatus) {
  const db=requireSupabase()
  const {data:session}=await db.auth.getSession()
  const token=session.session?.access_token
  if(!token) throw new Error('Sua sessão administrativa expirou.')
  const response=await fetch('/api/admin-professional-status',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({userId,status})})
  const payload=await response.json().catch(()=>({}))
  if(!response.ok) throw new Error(payload.error||'Não foi possível alterar o cadastro.')
}

export async function setAdminProfessionalPlan(organizationId: string, plan: AdminProfessional['plan']) {
  const { error } = await requireSupabase().rpc('admin_set_organization_plan', {
    target_organization_id: organizationId,
    new_plan: plan,
  })
  if (error) throw new Error(error.message)
}
