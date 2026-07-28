import { getUsers, saveUsers, toPublicUser, type AppUser, type PublicUser } from './auth'

export type InvitationStatus = 'pending' | 'accepted' | 'cancelled'

export interface PatientInvitation {
  id: string
  token: string
  professionalId: string
  patientName: string
  patientEmail: string
  patientPhone: string
  note?: string
  status: InvitationStatus
  createdAt: string
  acceptedAt?: string
  patientId?: string
}

export interface PatientLink {
  patientId: string
  professionalId: string
  invitationId: string
  linkedAt: string
}

const INVITATIONS_KEY = 'rede-maternar:invitations'
const LINKS_KEY = 'rede-maternar:patient-links'

const seedInvitations: PatientInvitation[] = [
  {
    id: 'invite-seed-1', token: 'bem-vinda-camila', professionalId: 'professional-1',
    patientName: 'Camila Ribeiro', patientEmail: 'camila.nova@exemplo.com', patientPhone: '(11) 99999-8888',
    note: 'Acompanhamento de amamentação', status: 'pending', createdAt: '2026-07-28T12:00:00.000Z',
  },
]

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (!raw) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
  try { return JSON.parse(raw) as T } catch { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
}
function write<T>(key: string, value: T) { if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value)) }

export function getInvitations() { return read<PatientInvitation[]>(INVITATIONS_KEY, seedInvitations) }
export function getPatientLinks() { return read<PatientLink[]>(LINKS_KEY, [{ patientId: 'patient-1', professionalId: 'professional-1', invitationId: 'seed-link', linkedAt: '2026-07-25T14:30:00.000Z' }]) }

export function createInvitation(input: Omit<PatientInvitation, 'id'|'token'|'status'|'createdAt'>) {
  const invitations = getInvitations()
  const invitation: PatientInvitation = {
    ...input,
    id: crypto.randomUUID(),
    token: crypto.randomUUID().replace(/-/g, '').slice(0, 18),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  write(INVITATIONS_KEY, [invitation, ...invitations])
  return invitation
}

export function cancelInvitation(id: string) {
  write(INVITATIONS_KEY, getInvitations().map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i))
}

export function getInvitationByToken(token: string) { return getInvitations().find(i => i.token === token) }

export function acceptInvitation(token: string, input: { name: string; email: string; phone: string; password: string }): PublicUser {
  const invitations = getInvitations()
  const invitation = invitations.find(i => i.token === token)
  if (!invitation || invitation.status === 'cancelled') throw new Error('Este convite não está mais disponível.')
  if (invitation.status === 'accepted') throw new Error('Este convite já foi utilizado.')
  const users = getUsers()
  const email = input.email.trim().toLowerCase()
  if (users.some(u => u.email.toLowerCase() === email)) throw new Error('Já existe uma conta com este e-mail.')
  const patient: AppUser = {
    id: crypto.randomUUID(), name: input.name.trim(), email, phone: input.phone.trim(), password: input.password,
    role: 'patient', status: 'active', createdAt: new Date().toISOString(),
  }
  saveUsers([patient, ...users])
  const acceptedAt = new Date().toISOString()
  write(INVITATIONS_KEY, invitations.map(i => i.id === invitation.id ? { ...i, status: 'accepted' as const, acceptedAt, patientId: patient.id } : i))
  write(LINKS_KEY, [{ patientId: patient.id, professionalId: invitation.professionalId, invitationId: invitation.id, linkedAt: acceptedAt }, ...getPatientLinks()])
  return toPublicUser(patient)
}

export function getProfessionalPatients(professionalId: string) {
  const links = getPatientLinks().filter(link => link.professionalId === professionalId)
  const users = getUsers()
  return links.map(link => ({ link, patient: users.find(user => user.id === link.patientId) })).filter(item => item.patient)
}

export function getPatientProfessional(patientId: string) {
  const link = getPatientLinks().find(item => item.patientId === patientId)
  if (!link) return null
  const professional = getUsers().find(user => user.id === link.professionalId)
  return professional ? { link, professional } : null
}
