import { getPatientProfessional, getProfessionalPatients } from './invitations'
import { getUsers } from './auth'

export type MessageKind = 'text' | 'file' | 'care-plan' | 'system'
export type DeliveryStatus = 'sent' | 'read'

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderRole: 'patient' | 'professional' | 'system'
  kind: MessageKind
  text: string
  createdAt: string
  status: DeliveryStatus
  attachment?: { name: string; type: string; size: number }
  carePlanId?: string
  pinned?: boolean
}

export interface Conversation {
  id: string
  patientId: string
  professionalId: string
  createdAt: string
  archived?: boolean
  favorite?: boolean
}

export interface MessageTemplate {
  id: string
  professionalId: string
  title: string
  content: string
  category: string
  createdAt: string
}

export interface CarePlanTask {
  id: string
  title: string
  details?: string
  completed: boolean
  completedAt?: string
}

export interface CarePlan {
  id: string
  conversationId: string
  patientId: string
  professionalId: string
  title: string
  introduction?: string
  tasks: CarePlanTask[]
  createdAt: string
  updatedAt: string
  status: 'active' | 'completed' | 'archived'
}

const CONVERSATIONS_KEY = 'rede-maternar:conversations'
const MESSAGES_KEY = 'rede-maternar:messages'
const TEMPLATES_KEY = 'rede-maternar:message-templates'
const CARE_PLANS_KEY = 'rede-maternar:care-plans'

const seedConversations: Conversation[] = [
  { id: 'conversation-seed-1', patientId: 'patient-1', professionalId: 'professional-1', createdAt: '2026-07-25T14:35:00.000Z', favorite: true },
]
const seedMessages: ChatMessage[] = [
  { id: 'message-seed-1', conversationId: 'conversation-seed-1', senderId: 'professional-1', senderRole: 'professional', kind: 'text', text: 'Olá! Este é o nosso espaço seguro de acompanhamento. Você pode me contar como vocês estão hoje?', createdAt: '2026-07-28T12:20:00.000Z', status: 'read' },
  { id: 'message-seed-2', conversationId: 'conversation-seed-1', senderId: 'patient-1', senderRole: 'patient', kind: 'text', text: 'Hoje a pega pareceu um pouco melhor, mas ainda sinto dor no início.', createdAt: '2026-07-28T12:28:00.000Z', status: 'read' },
]
const seedTemplates: MessageTemplate[] = [
  { id: 'template-1', professionalId: 'professional-1', title: 'Acolhimento inicial', category: 'Acompanhamento', content: 'Olá! Este é o nosso espaço de acompanhamento. Me conte como vocês estão hoje e o que mais precisa da minha atenção.', createdAt: '2026-07-28T10:00:00.000Z' },
  { id: 'template-2', professionalId: 'professional-1', title: 'Sinais de alerta', category: 'Orientação', content: 'Observe fraldas, estado geral do bebê, mamadas e sinais de desidratação. Caso perceba piora ou algo fora do habitual, procure avaliação médica.', createdAt: '2026-07-28T10:05:00.000Z' },
]
const seedCarePlans: CarePlan[] = [
  { id: 'care-seed-1', conversationId: 'conversation-seed-1', patientId: 'patient-1', professionalId: 'professional-1', title: 'Plano de cuidados — próximos 3 dias', introduction: 'Vamos focar em conforto, transferência de leite e estímulo da produção sem sobrecarregar você.', status: 'active', createdAt: '2026-07-28T12:35:00.000Z', updatedAt: '2026-07-28T12:35:00.000Z', tasks: [
    { id: 'task-1', title: 'Fazer pele a pele', details: 'Pelo menos 20 minutos em um momento tranquilo.', completed: true, completedAt: '2026-07-28T13:00:00.000Z' },
    { id: 'task-2', title: 'Observar sinais de transferência', details: 'Sucções profundas, pausas e deglutição.', completed: false },
    { id: 'task-3', title: 'Registrar número de fraldas', details: 'Anotar fraldas de xixi e cocô até o retorno.', completed: false },
  ] },
]

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  if (!raw) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
  try { return JSON.parse(raw) as T } catch { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
}
function write<T>(key: string, value: T) { if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value)) }

export function getConversations() { return read<Conversation[]>(CONVERSATIONS_KEY, seedConversations) }
export function getMessages() { return read<ChatMessage[]>(MESSAGES_KEY, seedMessages) }
export function getMessageTemplates() { return read<MessageTemplate[]>(TEMPLATES_KEY, seedTemplates) }
export function getCarePlans() { return read<CarePlan[]>(CARE_PLANS_KEY, seedCarePlans) }

export function ensureConversation(patientId: string, professionalId: string) {
  const current = getConversations()
  const existing = current.find(item => item.patientId === patientId && item.professionalId === professionalId)
  if (existing) return existing
  const conversation: Conversation = { id: crypto.randomUUID(), patientId, professionalId, createdAt: new Date().toISOString() }
  write(CONVERSATIONS_KEY, [conversation, ...current])
  return conversation
}

export function getConversationForPatient(patientId: string) {
  const relationship = getPatientProfessional(patientId)
  if (!relationship) return null
  return ensureConversation(patientId, relationship.professional.id)
}

export function getProfessionalConversations(professionalId: string) {
  const patients = getProfessionalPatients(professionalId)
  return patients.map(({ patient }) => ({ patient: patient!, conversation: ensureConversation(patient!.id, professionalId) }))
}

export function getConversationMessages(conversationId: string) {
  return getMessages().filter(message => message.conversationId === conversationId).sort((a,b) => a.createdAt.localeCompare(b.createdAt))
}

export function sendMessage(input: Omit<ChatMessage, 'id'|'createdAt'|'status'>) {
  const message: ChatMessage = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'sent' }
  write(MESSAGES_KEY, [...getMessages(), message])
  return message
}

export function markConversationRead(conversationId: string, readerId: string) {
  write(MESSAGES_KEY, getMessages().map(message => message.conversationId === conversationId && message.senderId !== readerId ? { ...message, status: 'read' as const } : message))
}

export function toggleConversationFavorite(id: string) {
  write(CONVERSATIONS_KEY, getConversations().map(item => item.id === id ? { ...item, favorite: !item.favorite } : item))
}

export function createTemplate(input: Omit<MessageTemplate, 'id'|'createdAt'>) {
  const item: MessageTemplate = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  write(TEMPLATES_KEY, [item, ...getMessageTemplates()])
  return item
}

export function deleteTemplate(id: string) { write(TEMPLATES_KEY, getMessageTemplates().filter(item => item.id !== id)) }

export function createCarePlan(input: { conversationId: string; patientId: string; professionalId: string; title: string; introduction?: string; tasks: { title: string; details?: string }[] }) {
  const now = new Date().toISOString()
  const plan: CarePlan = { ...input, id: crypto.randomUUID(), status: 'active', createdAt: now, updatedAt: now, tasks: input.tasks.filter(task => task.title.trim()).map(task => ({ id: crypto.randomUUID(), title: task.title.trim(), details: task.details?.trim(), completed: false })) }
  write(CARE_PLANS_KEY, [plan, ...getCarePlans()])
  sendMessage({ conversationId: input.conversationId, senderId: input.professionalId, senderRole: 'professional', kind: 'care-plan', text: `Novo plano de cuidados: ${input.title}`, carePlanId: plan.id })
  return plan
}

export function toggleCarePlanTask(planId: string, taskId: string) {
  const now = new Date().toISOString()
  const plans = getCarePlans().map(plan => {
    if (plan.id !== planId) return plan
    const tasks = plan.tasks.map(task => task.id === taskId ? { ...task, completed: !task.completed, completedAt: !task.completed ? now : undefined } : task)
    const completed = tasks.length > 0 && tasks.every(task => task.completed)
    return { ...plan, tasks, updatedAt: now, status: completed ? 'completed' as const : 'active' as const }
  })
  write(CARE_PLANS_KEY, plans)
}

export function getCarePlansForConversation(conversationId: string) { return getCarePlans().filter(plan => plan.conversationId === conversationId) }
export function getConversationParticipant(id: string) { return getUsers().find(user => user.id === id) }
