import { supabase } from './supabase'

function client() {
  if (!supabase) throw new Error('A conexão com o banco não está configurada.')
  return supabase
}

export async function getCurrentOrganization() {
  const db = client()
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) throw new Error('Sessão expirada.')
  const { data, error } = await db.from('organization_members')
    .select('organization_id, role, organizations(plan, type, status)')
    .eq('user_id', auth.user.id).eq('active', true).limit(1).single()
  if (error) throw new Error('Nenhuma organização foi vinculada a este acesso.')
  return { userId: auth.user.id, organizationId: data.organization_id, membership: data }
}

export type LeadStage = 'new' | 'first_contact_attempt' | 'second_contact_attempt' | 'future_contact' | 'scheduled' | 'completed' | 'lost'
export interface RealLead {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string
  status: LeadStage
  next_contact_at: string | null
  requested_professional_id: string | null
  created_at: string
}

export async function listLeads() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('leads').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RealLead[]
}

export async function createPatientAndLead(input: {
  name: string; phone: string; email?: string; source: string; stage: LeadStage; notes?: string
}) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const { data: patient, error: patientError } = await db.from('patient_profiles').insert({
    organization_id: organizationId,
    full_name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    created_by: userId,
  }).select('id').single()
  if (patientError) throw new Error(patientError.message)
  const { error } = await db.from('leads').insert({
    organization_id: organizationId,
    patient_id: patient.id,
    full_name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    source: input.source,
    status: input.stage,
    created_by: userId,
  })
  if (error) throw new Error(error.message)
}

export async function updateLeadStage(id: string, status: LeadStage) {
  const { error } = await client().from('leads').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listPatients() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('patient_profiles').select('*').eq('organization_id', organizationId).order('full_name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export interface RealService {
  id: string; name: string; description: string | null; duration_minutes: number
  price_cents: number; attendance_modes: string[]; marketplace_visible: boolean; active: boolean
}

export async function listServices() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('services').select('*').eq('organization_id', organizationId).order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as RealService[]
}

export async function createService(input: { name:string; description?:string; durationMinutes:number; price:number; attendanceModes:string[]; marketplaceVisible:boolean }) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const { error } = await db.from('services').insert({
    organization_id: organizationId, name: input.name.trim(), description: input.description?.trim() || null,
    duration_minutes: input.durationMinutes, price_cents: Math.round(input.price * 100),
    attendance_modes: input.attendanceModes, marketplace_visible: input.marketplaceVisible, created_by: userId,
  })
  if (error) throw new Error(error.message)
}

export async function setServiceActive(id:string, active:boolean) {
  const { error } = await client().from('services').update({ active }).eq('id', id)
  if (error) throw new Error(error.message)
}

export type FinancialEntryType = 'receivable'|'payable'|'income'|'expense'|'tax'|'payroll'
export interface RealFinancialEntry {
  id:string; type:FinancialEntryType; status:'pending'|'paid'|'overdue'|'cancelled'
  category:string; description:string; amount_cents:number; due_date:string|null
  paid_at:string|null; payment_method:string|null; recurring:boolean; created_at:string
}

export async function listFinancialEntries() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('financial_entries').select('*').eq('organization_id', organizationId).order('created_at', { ascending:false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RealFinancialEntry[]
}

export async function createFinancialEntry(input: { type:FinancialEntryType; category:string; description:string; amount:number; dueDate?:string; status?:RealFinancialEntry['status']; paymentMethod?:string; recurring?:boolean }) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const status = input.status ?? 'pending'
  const { error } = await db.from('financial_entries').insert({
    organization_id: organizationId, type: input.type, status, category: input.category.trim(),
    description: input.description.trim(), amount_cents: Math.round(input.amount * 100),
    due_date: input.dueDate || null, paid_at: status === 'paid' ? new Date().toISOString() : null,
    payment_method: input.paymentMethod || null, recurring: Boolean(input.recurring), created_by: userId,
  })
  if (error) throw new Error(error.message)
}

export interface RealCashSession { id:string; opened_at:string; opening_balance_cents:number; closed_at:string|null }

export async function getOpenCashSession() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('cash_sessions').select('*').eq('organization_id', organizationId)
    .is('closed_at', null).order('opened_at', { ascending:false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return data as RealCashSession | null
}

export async function openCashSession(openingBalance:number) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const existing = await getOpenCashSession()
  if (existing) return existing
  const { data, error } = await db.from('cash_sessions').insert({
    organization_id: organizationId, opened_by: userId, opening_balance_cents: Math.round(openingBalance * 100),
  }).select('*').single()
  if (error) throw new Error(error.message)
  return data as RealCashSession
}

export interface WhatsAppConnection {
  id:string; provider:'meta_cloud'|'evolution'; instance_name:string|null; phone_number:string|null
  status:'disconnected'|'connecting'|'connected'|'error'; connected_at:string|null; last_error:string|null
}

export async function getWhatsAppConnection() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('whatsapp_connections').select('*').eq('organization_id', organizationId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as WhatsAppConnection | null
}

export async function prepareWhatsAppConnection(provider:WhatsAppConnection['provider']) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const { data, error } = await db.from('whatsapp_connections').upsert({
    organization_id: organizationId, provider, instance_name: `rede-maternar-${organizationId.slice(0, 8)}`,
    status: 'disconnected', created_by: userId,
  }, { onConflict:'organization_id' }).select('*').single()
  if (error) throw new Error(error.message)
  return data as WhatsAppConnection
}
