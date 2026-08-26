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
  patient_id?: string | null
  assigned_professional_id?: string | null
}

export async function listLeads() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('leads').select('*').eq('organization_id', organizationId).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RealLead[]
}

export async function createPatientAndLead(input: {
  name: string; phone: string; email?: string; cpf?:string; source: string; stage: LeadStage; notes?: string; serviceInterest?:string
}) {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { error } = await db.rpc('upsert_crm_contact', { p_organization_id:organizationId, p_name:input.name.trim(), p_phone:input.phone.trim(), p_email:input.email?.trim()||null, p_cpf:input.cpf?.replace(/\D/g,'')||null, p_source:input.source, p_status:input.stage, p_notes:input.notes?.trim()||null, p_service_interest:input.serviceInterest?.trim()||null })
  if (error) throw new Error(error.message)
}

export async function getContactDetail(patientId:string) {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const [patient,lead,records,appointments,conversations]=await Promise.all([
    db.from('patient_profiles').select('*').eq('organization_id',organizationId).eq('id',patientId).single(),
    db.from('leads').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('patient_records').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('created_at',{ascending:false}),
    db.from('appointments').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('starts_at',{ascending:false}),
    db.from('conversations').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('updated_at',{ascending:false}),
  ])
  const error=patient.error||lead.error||records.error||appointments.error||conversations.error
  if(error) throw new Error(error.message)
  return {patient:patient.data,lead:lead.data,records:records.data??[],appointments:appointments.data??[],conversations:conversations.data??[]}
}

export async function updateContact(patientId:string,input:{name:string;phone:string;email?:string;cpf?:string;notes?:string}) {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const payload={full_name:input.name.trim(),phone:input.phone.trim(),email:input.email?.trim()||null,cpf:input.cpf?.replace(/\D/g,'')||null,notes:input.notes?.trim()||null}
  const {error}=await db.from('patient_profiles').update(payload).eq('organization_id',organizationId).eq('id',patientId)
  if(error) throw new Error(error.message)
  const {error:leadError}=await db.from('leads').update({full_name:payload.full_name,phone:payload.phone,email:payload.email}).eq('organization_id',organizationId).eq('patient_id',patientId)
  if(leadError) throw new Error(leadError.message)
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
  professional_name:string|null; specialty:string|null; professional_registration:string|null
  city:string|null; neighborhood:string|null; professional_id:string|null
}

export async function listServices() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('services').select('*').eq('organization_id', organizationId).order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as RealService[]
}

export async function createService(input: { name:string; description?:string; durationMinutes:number; price:number; attendanceModes:string[]; marketplaceVisible:boolean; professionalName:string; specialty:string; professionalRegistration:string; city:string; neighborhood:string; professionalId?:string }) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const { error } = await db.from('services').insert({
    organization_id: organizationId, name: input.name.trim(), description: input.description?.trim() || null,
    duration_minutes: input.durationMinutes, price_cents: Math.round(input.price * 100),
    attendance_modes: input.attendanceModes, marketplace_visible: input.marketplaceVisible, created_by: userId,
    professional_id:input.professionalId||null, professional_name:input.professionalName.trim(), specialty:input.specialty.trim(),
    professional_registration:input.professionalRegistration.trim(), city:input.city.trim(), neighborhood:input.neighborhood.trim(),
  })
  if (error) throw new Error(error.message)
}

export async function updateService(id:string,input: { name:string; description?:string; durationMinutes:number; price:number; attendanceModes:string[]; marketplaceVisible:boolean; professionalName:string; specialty:string; professionalRegistration:string; city:string; neighborhood:string }) {
  const {error}=await client().from('services').update({
    name:input.name.trim(),description:input.description?.trim()||null,duration_minutes:input.durationMinutes,
    price_cents:Math.round(input.price*100),attendance_modes:input.attendanceModes,marketplace_visible:input.marketplaceVisible,
    professional_name:input.professionalName.trim(),specialty:input.specialty.trim(),professional_registration:input.professionalRegistration.trim(),
    city:input.city.trim(),neighborhood:input.neighborhood.trim(),
  }).eq('id',id)
  if(error) throw new Error(error.message)
}

export async function listPatientRecords(patientId:string) {
  const {data,error}=await client().from('patient_records').select('*').eq('patient_id',patientId).order('created_at',{ascending:false})
  if(error) throw new Error(error.message)
  return data??[]
}

export async function createPatientRecord(patientId:string,content:string) {
  const db=client(); const {organizationId,userId}=await getCurrentOrganization()
  const {error}=await db.from('patient_records').insert({organization_id:organizationId,patient_id:patientId,author_id:userId,content:content.trim()})
  if(error) throw new Error(error.message)
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

export async function updateFinancialEntry(id:string,input:{type:FinancialEntryType;category:string;description:string;amount:number;dueDate?:string;status:RealFinancialEntry['status'];paymentMethod?:string;recurring?:boolean}) {
  const status=input.status
  const {data,error}=await client().from('financial_entries').update({
    type:input.type,status,category:input.category.trim(),description:input.description.trim(),
    amount_cents:Math.round(input.amount*100),due_date:input.dueDate||null,
    paid_at:status==='paid'?new Date().toISOString():null,payment_method:input.paymentMethod||null,
    recurring:Boolean(input.recurring),
  }).eq('id',id).select('*').single()
  if(error) throw new Error(error.message)
  return data as RealFinancialEntry
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

async function internalApi(path:string,init?:RequestInit) {
  const db=client(); const [{data:session},{organizationId}]=await Promise.all([db.auth.getSession(),getCurrentOrganization()])
  const response=await fetch(path,{...init,headers:{'content-type':'application/json','authorization':`Bearer ${session.session?.access_token||''}`,'x-organization-id':organizationId,...init?.headers}})
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(data.error||'Falha na integração.')
  return data
}

export async function getWhatsAppConnection() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('whatsapp_connections').select('*').eq('organization_id', organizationId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as WhatsAppConnection | null
}

export async function prepareWhatsAppConnection(provider:WhatsAppConnection['provider']) {
  if(provider!=='evolution')throw new Error('A API oficial da Meta será configurada separadamente.')
  const data=await internalApi('/api/evolution/instances',{method:'POST',body:JSON.stringify({})})
  return data.instance as WhatsAppConnection
}

export async function listWhatsAppConnections(){const data=await internalApi('/api/evolution/instances');return data.instances as WhatsAppConnection[]}
export async function getWhatsAppQrCode(id:string){return internalApi(`/api/evolution/qrcode?id=${encodeURIComponent(id)}`)}
export async function refreshWhatsAppStatus(id:string){return internalApi(`/api/evolution/status?id=${encodeURIComponent(id)}`)}

export interface RealAppointment {
  id:string; starts_at:string; ends_at:string; status:'scheduled'|'confirmed'|'in_service'|'completed'|'cancelled'|'no_show'
  is_return:boolean; is_paid_return:boolean; is_online:boolean; price_cents:number; payment_method:string|null; notes:string|null
  patient_id:string; professional_id:string
  patient_profiles:{full_name:string;phone:string|null}|null
  professional_profiles:{full_name:string}|null
}

export async function listAppointments() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db.from('appointments')
    .select('*, patient_profiles(full_name,phone), professional_profiles(full_name)')
    .eq('organization_id',organizationId).order('starts_at')
  if(error) throw new Error(error.message)
  return (data??[]) as unknown as RealAppointment[]
}

export async function createAppointment(input:{patientId:string;professionalId:string;startsAt:string;endsAt:string;price:number;isOnline:boolean;isReturn:boolean;isPaidReturn:boolean;notes?:string}) {
  const db=client(); const {organizationId,userId}=await getCurrentOrganization()
  const {error}=await db.from('appointments').insert({
    organization_id:organizationId,patient_id:input.patientId,professional_id:input.professionalId,
    starts_at:input.startsAt,ends_at:input.endsAt,price_cents:Math.round(input.price*100),
    is_online:input.isOnline,is_return:input.isReturn,is_paid_return:input.isPaidReturn,
    notes:input.notes?.trim()||null,created_by:userId,
  })
  if(error) throw new Error(error.message)
}

export async function updateAppointment(id:string, changes:Partial<Pick<RealAppointment,'status'|'payment_method'|'notes'|'starts_at'|'ends_at'>>) {
  const {error}=await client().from('appointments').update(changes).eq('id',id)
  if(error) throw new Error(error.message)
}

export async function markAppointmentPaid(appointment:RealAppointment,paymentMethod:string) {
  const db=client()
  await updateAppointment(appointment.id,{status:'completed',payment_method:paymentMethod})
  if(appointment.price_cents>0) {
    await createFinancialEntry({
      type:'income',category:'Atendimento',description:`Atendimento — ${appointment.patient_profiles?.full_name||'Paciente'}`,
      amount:appointment.price_cents/100,status:'paid',paymentMethod,
    })
  }
}

export async function listOrganizationProfessionals() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db.from('professional_profiles').select('id,full_name').eq('organization_id',organizationId).order('full_name')
  if(error) throw new Error(error.message)
  return data??[]
}

export interface RealTeamMember {
  id:string; full_name:string; email:string|null; professional_registration:string|null
  city:string; state_code:string; created_at:string
  professional_specialties:{specialties:{name:string}|{name:string}[]|null}[]
}

export async function listClinicTeam() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db.from('professional_profiles')
    .select('id,full_name,email,professional_registration,city,state_code,created_at,professional_specialties(specialties(name))')
    .eq('organization_id',organizationId).order('full_name')
  if(error) throw new Error(error.message)
  return (data??[]) as unknown as RealTeamMember[]
}

export async function createClinicTeamMember(input:{name:string;email:string;specialty:string;registration?:string}) {
  const {data,error}=await client().rpc('create_clinic_professional',{
    professional_name:input.name.trim(),professional_email:input.email.trim().toLowerCase(),
    specialty_name:input.specialty.trim(),registration:input.registration?.trim()||null,
  })
  if(error) throw new Error(error.message)
  return data as string
}

export async function listActiveSpecialties() {
  const {data,error}=await client().from('specialties').select('name').eq('active',true).order('name')
  if(error) throw new Error(error.message)
  return (data??[]) as {name:string}[]
}

export interface RealConversation {
  id:string;contact_name:string;contact_phone:string|null;channel:'internal'|'whatsapp_evolution'|'whatsapp_meta'
  unread_count:number;last_message_at:string|null
}
export interface RealConversationMessage {
  id:string;conversation_id:string;direction:'inbound'|'outbound';body:string
  status:'queued'|'sent'|'delivered'|'read'|'failed';created_at:string
}

export async function listConversations() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db.from('conversations').select('*').eq('organization_id',organizationId)
    .order('last_message_at',{ascending:false,nullsFirst:false})
  if(error) throw new Error(error.message)
  return (data??[]) as RealConversation[]
}

export async function listConversationMessages(conversationId:string) {
  const {data,error}=await client().from('conversation_messages').select('*').eq('conversation_id',conversationId).order('created_at')
  if(error) throw new Error(error.message)
  return (data??[]) as RealConversationMessage[]
}

export async function createConversation(input:{name:string;phone:string;channel:RealConversation['channel'];patientId?:string;leadId?:string}) {
  const db=client(); const {organizationId,userId}=await getCurrentOrganization()
  const {data,error}=await db.from('conversations').insert({
    organization_id:organizationId,patient_id:input.patientId||null,lead_id:input.leadId||null,
    channel:input.channel,contact_name:input.name.trim(),contact_phone:input.phone.trim(),created_by:userId,
  }).select('*').single()
  if(error) throw new Error(error.message)
  return data as RealConversation
}

export async function queueConversationMessage(conversation:RealConversation,body:string) {
  const db=client(); const {organizationId,userId}=await getCurrentOrganization()
  const connection=conversation.channel==='internal'?null:await getWhatsAppConnection()
  if(conversation.channel!=='internal'&&connection?.status!=='connected') {
    throw new Error('Conecte o WhatsApp desta organização antes de enviar mensagens por esse canal.')
  }
  if(conversation.channel!=='internal'){
    await internalApi('/api/evolution/send',{method:'POST',body:JSON.stringify({conversationId:conversation.id,connectionId:connection?.id,body})})
    return
  }
  const {error}=await db.from('conversation_messages').insert({
    organization_id:organizationId,conversation_id:conversation.id,sender_user_id:userId,
    direction:'outbound',body:body.trim(),status:conversation.channel==='internal'?'sent':'queued',
    sent_at:conversation.channel==='internal'?new Date().toISOString():null,
  })
  if(error) throw new Error(error.message)
  await db.from('conversations').update({last_message_at:new Date().toISOString()}).eq('id',conversation.id)
}

export async function updateFinancialEntryStatus(id:string,status:RealFinancialEntry['status']) {
  const {error}=await client().from('financial_entries').update({
    status,paid_at:status==='paid'?new Date().toISOString():null,
  }).eq('id',id)
  if(error) throw new Error(error.message)
}

export async function closeCashSession(id:string,closingBalance:number) {
  const db=client(); const {userId}=await getCurrentOrganization()
  const {error}=await db.from('cash_sessions').update({
    closed_by:userId,closed_at:new Date().toISOString(),closing_balance_cents:Math.round(closingBalance*100),
  }).eq('id',id)
  if(error) throw new Error(error.message)
}

export async function getPlatformSummary() {
  const {data,error}=await client().rpc('admin_platform_summary')
  if(error) throw new Error(error.message)
  return data as {organizations:number;active_organizations:number;pending_organizations:number;professionals:number;patients:number;appointments:number;prospects:number;pending_notifications:number}
}

export async function listAdminProspects() {
  const {data,error}=await client().rpc('admin_list_prospects')
  if(error) throw new Error(error.message)
  return data??[]
}

export async function reviewAdminProspect(id:string,status:'approved'|'rejected'|'duplicate',publish=false) {
  const {error}=await client().rpc('admin_review_clinic_prospect',{target_id:id,new_review_status:status,publish})
  if(error) throw new Error(error.message)
}

export type DirectoryProfessional={id:string;name:string;primary_specialty:string;specialty_slug:string;city:string;city_slug:string;neighborhood:string|null;state_code:string;is_claimed:boolean;plan_type:'basic'|'premium';total_count?:number}

export async function searchProfessionalDirectory(specialtySlug:string,stateCode:string,citySlug:string,page=1,pageSize=20) {
  const {data,error}=await client().rpc('directory_search',{requested_specialty_slug:specialtySlug,requested_state_code:stateCode,requested_city_slug:citySlug,requested_page:page,requested_page_size:pageSize})
  if(error) throw new Error(error.message)
  return (data??[]) as DirectoryProfessional[]
}

export async function listDirectoryFallback(specialtySlug:string,stateCode:string,citySlug:string) {
  const {data,error}=await client().rpc('directory_fallback',{requested_specialty_slug:specialtySlug,requested_state_code:stateCode,requested_city_slug:citySlug})
  if(error) throw new Error(error.message)
  return (data??[]) as DirectoryProfessional[]
}

export async function getDirectoryProfessional(id:string) {
  const {data,error}=await client().from('published_clinic_directory').select('*').eq('id',id).maybeSingle()
  if(error) throw new Error(error.message)
  return data as DirectoryProfessional|null
}

export async function listMarketplaceProfessionals() {
  const {data,error}=await client().from('marketplace_professionals').select('*').order('verified',{ascending:false}).order('full_name')
  if(error) throw new Error(error.message)
  return data??[]
}

export async function recordProfessionalProfileView(professionalId:string) {
  const {error}=await client().rpc('record_professional_profile_view',{target_professional_id:professionalId})
  if(error) throw new Error(error.message)
}

export async function listMyProfileViewCounts() {
  const {data,error}=await client().rpc('my_profile_view_counts')
  if(error) throw new Error(error.message)
  return (data??[]) as {professional_id:string;full_name:string;view_count:number}[]
}

export interface RealProfessionalProfile {
  id:string;full_name:string;professional_registration:string|null;bio:string|null
  whatsapp:string|null;email:string|null;city:string;state_code:string;neighborhood:string|null
  clinic_name:string|null;accepts_online:boolean;marketplace_visible:boolean;verified:boolean
  website_url:string|null;instagram_handle:string|null;accepted_insurances:string[]
  facebook_url:string|null;tiktok_url:string|null
  payment_methods:string[];profile_completed:boolean
  profile_image_url:string|null;cover_image_url:string|null;office_video_url:string|null;office_video_urls:string[]
  gallery_urls:string[];clinic_description:string|null;opening_hours:string|null
  postal_code:string|null;address_line:string|null;address_number:string|null;address_complement:string|null
}

export async function getMyProfessionalProfile() {
  const db=client(); const {organizationId,userId}=await getCurrentOrganization()
  let query=db.from('professional_profiles').select('*').eq('organization_id',organizationId)
  const {data,error}=await query.eq('user_id',userId).maybeSingle()
  if(error) throw new Error(error.message)
  if(data) return data as RealProfessionalProfile
  const fallback=await db.from('professional_profiles').select('*').eq('organization_id',organizationId).limit(1).maybeSingle()
  if(fallback.error) throw new Error(fallback.error.message)
  if(fallback.data) return fallback.data as RealProfessionalProfile
  const created=await db.rpc('ensure_my_professional_profile')
  if(created.error) throw new Error(created.error.message)
  const result=await db.from('professional_profiles').select('*').eq('id',created.data).single()
  if(result.error) throw new Error(result.error.message)
  return result.data as RealProfessionalProfile
}

export async function updateMyProfessionalProfile(id:string,changes:Partial<RealProfessionalProfile>) {
  const allowed={
    full_name:changes.full_name,professional_registration:changes.professional_registration,
    bio:changes.bio,whatsapp:changes.whatsapp,email:changes.email,city:changes.city,
    state_code:changes.state_code,neighborhood:changes.neighborhood,clinic_name:changes.clinic_name,
    accepts_online:changes.accepts_online,
    website_url:changes.website_url,instagram_handle:changes.instagram_handle,
    facebook_url:changes.facebook_url,tiktok_url:changes.tiktok_url,
    accepted_insurances:changes.accepted_insurances,payment_methods:changes.payment_methods,
    profile_completed:changes.profile_completed,
    profile_image_url:changes.profile_image_url,cover_image_url:changes.cover_image_url,
    office_video_url:changes.office_video_url,office_video_urls:changes.office_video_urls,gallery_urls:changes.gallery_urls,
    clinic_description:changes.clinic_description,opening_hours:changes.opening_hours,
    postal_code:changes.postal_code,address_line:changes.address_line,address_number:changes.address_number,
    address_complement:changes.address_complement,
  }
  const {data,error}=await client().from('professional_profiles').update(allowed).eq('id',id).select('*').single()
  if(error) throw new Error(error.message)
  if(!data) throw new Error('O perfil não foi confirmado pelo banco de dados.')
  return data as RealProfessionalProfile
}

export async function uploadMarketplaceMedia(file:File,kind:'profile'|'cover'|'gallery'|'video') {
  const db=client(); const {userId}=await getCurrentOrganization()
  const isVideo=kind==='video'
  if(isVideo&&!file.type.startsWith('video/')) throw new Error('Escolha um arquivo de vídeo.')
  if(!isVideo&&!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if(file.size>(isVideo?80:8)*1024*1024) throw new Error(isVideo?'Cada vídeo deve ter no máximo 80 MB.':'Cada imagem deve ter no máximo 8 MB.')
  const extension=(file.name.split('.').pop()||'jpg').toLowerCase()
  const path=`${userId}/${kind}-${crypto.randomUUID()}.${extension}`
  const {error}=await db.storage.from('marketplace-media').upload(path,file,{upsert:false,contentType:file.type})
  if(error) throw new Error(error.message)
  return db.storage.from('marketplace-media').getPublicUrl(path).data.publicUrl
}

export const uploadMarketplaceImage=uploadMarketplaceMedia

export async function getProfessionalSpecialtyEditor(professionalId:string) {
  const db=client()
  const [{data:options,error:optionsError},{data:assigned,error:assignedError}]=await Promise.all([
    db.from('specialties').select('id,name').eq('active',true).order('name'),
    db.from('professional_specialties').select('specialty_id,specialties(name)').eq('professional_id',professionalId),
  ])
  if(optionsError) throw new Error(optionsError.message)
  if(assignedError) throw new Error(assignedError.message)
  return {
    options:(options??[]) as {id:string;name:string}[],
    selected:(assigned??[]).map((item:any)=>Array.isArray(item.specialties)?item.specialties[0]?.name:item.specialties?.name).filter(Boolean) as string[],
  }
}

export async function saveProfessionalSpecialties(professionalId:string,names:string[],limit:number|null) {
  const db=client()
  const unique=[...new Set(names.map(name=>name.trim()).filter(Boolean))]
  if(limit!==null&&unique.length>limit) throw new Error(`Este plano permite até ${limit} especialidades.`)
  const {data:rows,error:lookupError}=unique.length
    ? await db.from('specialties').select('id,name').in('name',unique).eq('active',true)
    : {data:[],error:null}
  if(lookupError) throw new Error(lookupError.message)
  if((rows??[]).length!==unique.length) throw new Error('Uma das especialidades selecionadas não está disponível.')
  const {error:deleteError}=await db.from('professional_specialties').delete().eq('professional_id',professionalId)
  if(deleteError) throw new Error(deleteError.message)
  if(rows?.length){
    const {error:insertError}=await db.from('professional_specialties').insert(rows.map((row,index)=>({professional_id:professionalId,specialty_id:row.id,is_primary:index===0})))
    if(insertError) throw new Error(insertError.message)
  }
}

export async function getMarketplaceProfessional(id:string) {
  const {data,error}=await client().from('marketplace_professionals').select('*').eq('id',id).maybeSingle()
  if(error) throw new Error(error.message)
  return data
}

export async function listPublicServices(professionalId:string) {
  const db=client()
  const {data,error}=await db.from('marketplace_services').select('*').eq('professional_profile_id',professionalId).order('name')
  if(error) throw new Error(error.message)
  return data??[]
}
