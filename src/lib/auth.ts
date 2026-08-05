import type { UserRole } from './types'
import type { ProfessionalPlan } from './plans'

export type UserStatus = 'active' | 'pending' | 'suspended' | 'rejected'

export interface AppUser {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  status: UserStatus
  createdAt: string
  specialty?: string
  city?: string
  phone?: string
  registration?: string
  plan?: ProfessionalPlan
}

export type PublicUser = Omit<AppUser, 'password'>

const USERS_KEY = 'rede-maternar:users'
const SESSION_KEY = 'rede-maternar:session'

const seedUsers: AppUser[] = []

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function getUsers(): AppUser[] {
  if (!canUseStorage()) return seedUsers
  const raw = localStorage.getItem(USERS_KEY)
  if (!raw) {
    localStorage.setItem(USERS_KEY, JSON.stringify(seedUsers))
    return seedUsers
  }
  try {
    const parsed = JSON.parse(raw) as AppUser[]
    const migratedUsers = parsed.map((user) =>
      ['annual','business'].includes(String((user as AppUser & { plan?: string }).plan)) ? { ...user, plan: 'clinic' as ProfessionalPlan } : user,
    )
    const migrated = [...migratedUsers, ...seedUsers.filter((seed) => !migratedUsers.some((user) => user.id === seed.id))]
    localStorage.setItem(USERS_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify(seedUsers))
    return seedUsers
  }
}

export function saveUsers(users: AppUser[]) {
  if (canUseStorage()) localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function toPublicUser(user: AppUser): PublicUser {
  const { password: _password, ...publicUser } = user
  return publicUser
}

export function getSession(): PublicUser | null {
  if (!canUseStorage()) return null
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PublicUser
  } catch {
    return null
  }
}

export function setSession(user: PublicUser | null) {
  if (!canUseStorage()) return
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_KEY)
}

export function authenticate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = getUsers().find(
    (candidate) => candidate.email.toLowerCase() === normalizedEmail && candidate.password === password,
  )
  if (!user) throw new Error('E-mail ou senha incorretos.')
  if (user.status === 'pending') throw new Error('Seu cadastro ainda está aguardando aprovação.')
  if (user.status === 'suspended') throw new Error('Este acesso está suspenso. Fale com o suporte.')
  if (user.status === 'rejected') throw new Error('Este cadastro não foi aprovado.')
  return toPublicUser(user)
}

export interface RegisterProfessionalInput {
  name: string
  organizationName?: string
  email: string
  password: string
  specialty: string
  city: string
  phone: string
  registration?: string
  plan?: ProfessionalPlan
  insurances?: string[]
}

export function registerProfessional(input: RegisterProfessionalInput) {
  const users = getUsers()
  const normalizedEmail = input.email.trim().toLowerCase()
  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    throw new Error('Já existe um cadastro com este e-mail.')
  }
  const user: AppUser = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    email: normalizedEmail,
    password: input.password,
    role: 'professional',
    status: 'pending',
    specialty: input.specialty,
    city: input.city.trim(),
    phone: input.phone.trim(),
    registration: input.registration?.trim(),
    plan: input.plan,
    createdAt: new Date().toISOString(),
  }
  saveUsers([user, ...users])
  return toPublicUser(user)
}

export function updateUserStatus(id: string, status: UserStatus) {
  const users = getUsers().map((user) => (user.id === id ? { ...user, status } : user))
  saveUsers(users)
  return users.find((user) => user.id === id)
}
