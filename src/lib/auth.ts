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

const seedUsers: AppUser[] = [
  {
    id: 'admin-1',
    name: 'Jéssica Calegari',
    email: 'admin@redematernar.com',
    password: '123456',
    role: 'admin',
    status: 'active',
    createdAt: '2026-07-28T09:00:00.000Z',
  },
  {
    id: 'professional-1',
    name: 'Dra. Marina Lopes',
    email: 'profissional@redematernar.com',
    password: '123456',
    role: 'professional',
    status: 'active',
    specialty: 'Fonoaudiologia',
    plan: 'annual',
    city: 'São Paulo, SP',
    createdAt: '2026-07-24T12:00:00.000Z',
  },
  {
    id: 'professional-free',
    name: 'Paula Nascimento',
    email: 'gratuito@redematernar.com',
    password: '123456',
    role: 'professional',
    status: 'active',
    plan: 'free',
    specialty: 'Doula',
    city: 'São Paulo, SP',
    createdAt: '2026-07-28T12:00:00.000Z',
  },
  {
    id: 'patient-1',
    name: 'Camila Ribeiro',
    email: 'paciente@redematernar.com',
    password: '123456',
    role: 'patient',
    status: 'active',
    createdAt: '2026-07-25T14:30:00.000Z',
  },
  {
    id: 'professional-pending',
    name: 'Ana Paula Mendes',
    plan: 'free',
    email: 'ana@exemplo.com',
    password: '123456',
    role: 'professional',
    status: 'pending',
    specialty: 'Nutrição materno-infantil',
    city: 'Campinas, SP',
    registration: 'CRN 00000',
    createdAt: '2026-07-27T16:20:00.000Z',
  },
]

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
    return JSON.parse(raw) as AppUser[]
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
  email: string
  password: string
  specialty: string
  city: string
  phone: string
  registration?: string
  plan?: ProfessionalPlan
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
