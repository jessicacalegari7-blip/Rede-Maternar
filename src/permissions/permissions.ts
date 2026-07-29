import type { PublicUser } from '../lib/auth'

export type Capability =
  | 'refer_patients' | 'receive_referrals' | 'clinical_care' | 'appointments'
  | 'chat' | 'medical_records' | 'care_plans' | 'charge' | 'wallet'
  | 'manage_users' | 'manage_finance' | 'manage_content' | 'support'

const community = new Set<Capability>(['refer_patients'])
const annual = new Set<Capability>([
  'refer_patients', 'receive_referrals', 'clinical_care', 'appointments', 'chat',
  'medical_records', 'care_plans', 'charge', 'wallet',
])
const admin = new Set<Capability>([
  'manage_users', 'manage_finance', 'manage_content', 'support', 'medical_records',
])

export function can(user: PublicUser | null, capability: Capability) {
  if (!user || user.status !== 'active') return false
  if (user.role === 'admin') return admin.has(capability)
  if (user.role === 'patient') return ['appointments', 'chat', 'medical_records', 'care_plans'].includes(capability)
  return (user.plan === 'business' ? annual : community).has(capability)
}
