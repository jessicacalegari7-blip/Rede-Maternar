import { getAppointments, type Appointment } from './appointments'
import { getUsers } from './auth'

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'pix' | 'card' | 'bank_transfer'
export type WithdrawalStatus = 'requested' | 'approved' | 'paid' | 'rejected'

export interface Payment {
  id: string
  appointmentId: string
  patientId: string
  professionalId: string
  amount: number
  platformFee: number
  commissionAmount: number
  professionalNet: number
  method?: PaymentMethod
  installments?: number
  status: PaymentStatus
  pixCode?: string
  transactionId?: string
  createdAt: string
  paidAt?: string
  refundedAt?: string
}

export interface Withdrawal {
  id: string
  professionalId: string
  amount: number
  status: WithdrawalStatus
  bankLabel: string
  requestedAt: string
  reviewedAt?: string
}

const PAYMENTS_KEY = 'rede-maternar:payments'
const WITHDRAWALS_KEY = 'rede-maternar:withdrawals'
const PLATFORM_FEE_RATE = 0.08
const COMMISSION_RATE = 0.15

function storageAvailable() { return typeof window !== 'undefined' && Boolean(window.localStorage) }
function read<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback
  const raw = localStorage.getItem(key)
  if (!raw) { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
  try { return JSON.parse(raw) as T } catch { localStorage.setItem(key, JSON.stringify(fallback)); return fallback }
}
function write<T>(key: string, value: T) { if (storageAvailable()) localStorage.setItem(key, JSON.stringify(value)) }
function now() { return new Date().toISOString() }
function pixCode(id: string, amount: number) { return `00020126REDEMATERNAR-${id.slice(0,8)}-BRL-${amount.toFixed(2)}` }

function financials(amount: number) {
  const platformFee = Number((amount * PLATFORM_FEE_RATE).toFixed(2))
  const commissionAmount = Number((amount * COMMISSION_RATE).toFixed(2))
  return { platformFee, commissionAmount, professionalNet: Number((amount - platformFee - commissionAmount).toFixed(2)) }
}

function seedPayments(): Payment[] {
  const appointments = getAppointments()
  return appointments.slice(0, 2).map((appointment, index) => {
    const values = financials(appointment.price)
    const paid = index === 0
    return {
      id: `payment-seed-${index + 1}`,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      professionalId: appointment.professionalId,
      amount: appointment.price,
      ...values,
      method: paid ? 'pix' : undefined,
      status: paid ? 'paid' : 'pending',
      transactionId: paid ? 'RM-SEED-001' : undefined,
      createdAt: appointment.createdAt,
      paidAt: paid ? appointment.createdAt : undefined,
    }
  })
}

export function getPayments() {
  const current = read<Payment[]>(PAYMENTS_KEY, seedPayments())
  const existingAppointmentIds = new Set(current.map(item => item.appointmentId))
  const missing = getAppointments().filter(item => item.status !== 'cancelled' && !existingAppointmentIds.has(item.id)).map(appointment => ({
    id: crypto.randomUUID(), appointmentId: appointment.id, patientId: appointment.patientId, professionalId: appointment.professionalId,
    amount: appointment.price, ...financials(appointment.price), status: 'pending' as const, createdAt: now(),
  }))
  if (missing.length) { const next = [...current, ...missing]; write(PAYMENTS_KEY, next); return next }
  return current
}

export function getPatientPayments(patientId: string) { return getPayments().filter(item => item.patientId === patientId) }
export function getProfessionalPayments(professionalId: string) { return getPayments().filter(item => item.professionalId === professionalId) }
export function getWithdrawals() { return read<Withdrawal[]>(WITHDRAWALS_KEY, []) }
export function getProfessionalWithdrawals(professionalId: string) { return getWithdrawals().filter(item => item.professionalId === professionalId) }

export function payPayment(paymentId: string, method: PaymentMethod, installments = 1) {
  const payments = getPayments(); const payment = payments.find(item => item.id === paymentId)
  if (!payment) throw new Error('Cobrança não encontrada.')
  if (payment.status === 'paid') throw new Error('Este pagamento já foi confirmado.')
  const updated: Payment = { ...payment, method, installments: method === 'card' ? installments : 1, status: 'paid', paidAt: now(), transactionId: `RM-${Date.now()}`, pixCode: method === 'pix' ? pixCode(payment.id, payment.amount) : undefined }
  write(PAYMENTS_KEY, payments.map(item => item.id === paymentId ? updated : item)); return updated
}

export function generatePix(paymentId: string) {
  const payments = getPayments(); const payment = payments.find(item => item.id === paymentId)
  if (!payment) throw new Error('Cobrança não encontrada.')
  const updated = { ...payment, method: 'pix' as const, status: 'processing' as const, pixCode: pixCode(payment.id, payment.amount) }
  write(PAYMENTS_KEY, payments.map(item => item.id === paymentId ? updated : item)); return updated
}

export function confirmPix(paymentId: string) { return payPayment(paymentId, 'pix', 1) }
export function refundPayment(paymentId: string) {
  write(PAYMENTS_KEY, getPayments().map(item => item.id === paymentId && item.status === 'paid' ? { ...item, status: 'refunded' as const, refundedAt: now() } : item))
}

export function getWalletSummary(professionalId: string) {
  const payments = getProfessionalPayments(professionalId)
  const paid = payments.filter(item => item.status === 'paid')
  const totalReceived = paid.reduce((sum,item) => sum + item.amount, 0)
  const fees = paid.reduce((sum,item) => sum + item.platformFee, 0)
  const commissions = paid.reduce((sum,item) => sum + item.commissionAmount, 0)
  const net = paid.reduce((sum,item) => sum + item.professionalNet, 0)
  const withdrawals = getProfessionalWithdrawals(professionalId).filter(item => ['requested','approved','paid'].includes(item.status)).reduce((sum,item) => sum + item.amount, 0)
  return { totalReceived, fees, commissions, net, available: Math.max(0, net - withdrawals), pending: payments.filter(item => ['pending','processing'].includes(item.status)).reduce((sum,item)=>sum+item.amount,0) }
}

export function requestWithdrawal(professionalId: string, amount: number, bankLabel: string) {
  const summary = getWalletSummary(professionalId)
  if (amount <= 0) throw new Error('Informe um valor válido.')
  if (amount > summary.available) throw new Error('O valor é maior que o saldo disponível.')
  const withdrawal: Withdrawal = { id:crypto.randomUUID(), professionalId, amount, status:'requested', bankLabel, requestedAt:now() }
  write(WITHDRAWALS_KEY, [withdrawal, ...getWithdrawals()]); return withdrawal
}

export function reviewWithdrawal(id: string, status: 'approved'|'paid'|'rejected') {
  write(WITHDRAWALS_KEY, getWithdrawals().map(item => item.id === id ? { ...item, status, reviewedAt:now() } : item))
}

export function getPaymentDetails(payment: Payment) {
  const users = getUsers(); const appointment = getAppointments().find(item => item.id === payment.appointmentId)
  return { ...payment, patientName: users.find(item => item.id === payment.patientId)?.name || 'Paciente', professionalName: users.find(item => item.id === payment.professionalId)?.name || 'Profissional', appointment }
}
export function getWithdrawalDetails(withdrawal: Withdrawal) { return { ...withdrawal, professionalName:getUsers().find(item=>item.id===withdrawal.professionalId)?.name || 'Profissional' } }

export const paymentStatusLabels: Record<PaymentStatus,string> = { pending:'Aguardando pagamento', processing:'Pix gerado', paid:'Pago', failed:'Falhou', refunded:'Reembolsado' }
export const paymentStatusClass: Record<PaymentStatus,string> = { pending:'status-scheduled', processing:'status-confirmed', paid:'status-completed', failed:'status-cancelled', refunded:'status-no-show' }
export const paymentMethodLabels: Record<PaymentMethod,string> = { pix:'Pix', card:'Cartão', bank_transfer:'Transferência' }
export const withdrawalStatusLabels: Record<WithdrawalStatus,string> = { requested:'Solicitado', approved:'Aprovado', paid:'Pago', rejected:'Rejeitado' }
export type { Appointment }
