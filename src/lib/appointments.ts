import { getProfileByUserId, type AttendanceMode, type ProfessionalService } from './professionalProfile'
import { getUsers } from './auth'

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface ScheduleBlock {
  id: string
  professionalId: string
  date: string
  start: string
  end: string
  reason: string
  recurringWeekly?: boolean
  createdAt: string
}

export interface Appointment {
  id: string
  professionalId: string
  patientId: string
  serviceId: string
  serviceName: string
  date: string
  start: string
  end: string
  durationMinutes: number
  price: number
  mode: AttendanceMode
  status: AppointmentStatus
  patientNote?: string
  internalNote?: string
  createdAt: string
  updatedAt: string
}

const APPOINTMENTS_KEY = 'rede-maternar:appointments'
const BLOCKS_KEY = 'rede-maternar:schedule-blocks'

function storageAvailable() { return typeof window !== 'undefined' && Boolean(window.localStorage) }
function read<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback
  const raw = localStorage.getItem(key)
  if (!raw) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
  try { return JSON.parse(raw) as T } catch { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
}
function write<T>(key: string, value: T) { if (storageAvailable()) localStorage.setItem(key, JSON.stringify(value)) }

function isoDate(date: Date) { return date.toISOString().slice(0, 10) }
function addDays(amount: number) { const date = new Date(); date.setHours(12,0,0,0); date.setDate(date.getDate() + amount); return isoDate(date) }
function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(':').map(Number)
  const total = hour * 60 + minute + minutes
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
}
function toMinutes(time: string) { const [h,m] = time.split(':').map(Number); return h * 60 + m }
function overlaps(startA: string, endA: string, startB: string, endB: string) { return toMinutes(startA) < toMinutes(endB) && toMinutes(endA) > toMinutes(startB) }

const now = new Date().toISOString()
const seedAppointments: Appointment[] = [
  { id:'appointment-seed-1', professionalId:'professional-1', patientId:'patient-1', serviceId:'service-1', serviceName:'Avaliação fonoaudiológica do bebê', date:addDays(1), start:'09:30', end:'10:30', durationMinutes:60, price:390, mode:'office', status:'confirmed', patientNote:'Gostaria de avaliar a sucção durante a mamada.', createdAt:now, updatedAt:now },
  { id:'appointment-seed-2', professionalId:'professional-1', patientId:'patient-1', serviceId:'service-2', serviceName:'Acompanhamento on-line', date:addDays(4), start:'14:00', end:'14:40', durationMinutes:40, price:250, mode:'online', status:'scheduled', createdAt:now, updatedAt:now },
]

const seedBlocks: ScheduleBlock[] = [
  { id:'block-seed-1', professionalId:'professional-1', date:addDays(2), start:'12:00', end:'14:00', reason:'Compromisso pessoal', createdAt:now },
]

export function getAppointments() { return read<Appointment[]>(APPOINTMENTS_KEY, seedAppointments) }
export function getScheduleBlocks() { return read<ScheduleBlock[]>(BLOCKS_KEY, seedBlocks) }
export function getProfessionalAppointments(professionalId: string) { return getAppointments().filter(item => item.professionalId === professionalId).sort((a,b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)) }
export function getPatientAppointments(patientId: string) { return getAppointments().filter(item => item.patientId === patientId).sort((a,b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)) }

export function createScheduleBlock(input: Omit<ScheduleBlock,'id'|'createdAt'>) {
  const block: ScheduleBlock = { ...input, id:crypto.randomUUID(), createdAt:new Date().toISOString() }
  write(BLOCKS_KEY, [block, ...getScheduleBlocks()])
  return block
}
export function removeScheduleBlock(id: string) { write(BLOCKS_KEY, getScheduleBlocks().filter(item => item.id !== id)) }

export function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const updatedAt = new Date().toISOString()
  write(APPOINTMENTS_KEY, getAppointments().map(item => item.id === id ? { ...item, status, updatedAt } : item))
}
export function updateAppointmentInternalNote(id: string, internalNote: string) {
  const updatedAt = new Date().toISOString()
  write(APPOINTMENTS_KEY, getAppointments().map(item => item.id === id ? { ...item, internalNote, updatedAt } : item))
}

export function rescheduleAppointment(id: string, date: string, start: string) {
  const appointments = getAppointments()
  const appointment = appointments.find(item => item.id === id)
  if (!appointment) throw new Error('Agendamento não encontrado.')
  const end = addMinutes(start, appointment.durationMinutes)
  const conflict = appointments.some(item => item.id !== id && item.professionalId === appointment.professionalId && item.date === date && !['cancelled'].includes(item.status) && overlaps(start,end,item.start,item.end))
  if (conflict) throw new Error('Este horário já está ocupado.')
  write(APPOINTMENTS_KEY, appointments.map(item => item.id === id ? { ...item, date, start, end, status:'scheduled' as const, updatedAt:new Date().toISOString() } : item))
}

export function createAppointment(input: { professionalId:string; patientId:string; service:ProfessionalService; date:string; start:string; mode:AttendanceMode; patientNote?:string }) {
  const end = addMinutes(input.start, input.service.durationMinutes)
  const appointments = getAppointments()
  const conflict = appointments.some(item => item.professionalId === input.professionalId && item.date === input.date && item.status !== 'cancelled' && overlaps(input.start,end,item.start,item.end))
  if (conflict) throw new Error('Este horário acabou de ser reservado. Escolha outro horário.')
  const blocked = getScheduleBlocks().some(block => block.professionalId === input.professionalId && (block.date === input.date || block.recurringWeekly && new Date(`${block.date}T12:00:00`).getDay() === new Date(`${input.date}T12:00:00`).getDay()) && overlaps(input.start,end,block.start,block.end))
  if (blocked) throw new Error('Este horário não está mais disponível.')
  const appointment: Appointment = {
    id:crypto.randomUUID(), professionalId:input.professionalId, patientId:input.patientId,
    serviceId:input.service.id, serviceName:input.service.name, date:input.date, start:input.start, end,
    durationMinutes:input.service.durationMinutes, price:input.service.price, mode:input.mode,
    status:'scheduled', patientNote:input.patientNote?.trim(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
  }
  write(APPOINTMENTS_KEY, [...appointments, appointment])
  return appointment
}

export function getAvailableSlots(professionalId:string, service:ProfessionalService, date:string) {
  const profile = getProfileByUserId(professionalId)
  if (!profile) return []
  const weekday = new Date(`${date}T12:00:00`).getDay()
  const availability = profile.availability.find(item => item.weekday === weekday)
  if (!availability?.enabled) return []
  const slots:string[] = []
  const step = 30
  let cursor = availability.start
  while (toMinutes(addMinutes(cursor, service.durationMinutes)) <= toMinutes(availability.end)) {
    const end = addMinutes(cursor, service.durationMinutes)
    const appointmentConflict = getAppointments().some(item => item.professionalId === professionalId && item.date === date && item.status !== 'cancelled' && overlaps(cursor,end,item.start,item.end))
    const blockConflict = getScheduleBlocks().some(block => block.professionalId === professionalId && (block.date === date || block.recurringWeekly && new Date(`${block.date}T12:00:00`).getDay() === weekday) && overlaps(cursor,end,block.start,block.end))
    if (!appointmentConflict && !blockConflict) slots.push(cursor)
    cursor = addMinutes(cursor, step)
  }
  return slots
}

export function getAppointmentDetails(appointment: Appointment) {
  const users = getUsers()
  return {
    ...appointment,
    patientName: users.find(user => user.id === appointment.patientId)?.name || 'Paciente',
    professionalName: users.find(user => user.id === appointment.professionalId)?.name || 'Profissional',
  }
}

export const appointmentStatusLabels: Record<AppointmentStatus,string> = {
  scheduled:'Agendada', confirmed:'Confirmada', completed:'Concluída', cancelled:'Cancelada', no_show:'Ausência',
}
export const appointmentStatusClass: Record<AppointmentStatus,string> = {
  scheduled:'status-scheduled', confirmed:'status-confirmed', completed:'status-completed', cancelled:'status-cancelled', no_show:'status-no-show',
}
export { addMinutes }
