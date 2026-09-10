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
  pipeline_id?: string | null
  stage_id?: string | null
  position?: number
  interest?: string | null
  next_action?: string | null
  last_interaction_at?: string | null
}

export interface CrmPipelineStage {
  id:string; pipeline_id:string; name:string; color:string; position:number
  legacy_status:LeadStage|null; is_won:boolean; is_lost:boolean
}

export async function listCrmStages() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db.from('crm_pipeline_stages').select('*').eq('organization_id',organizationId).eq('active',true).is('archived_at',null).order('position')
  if(error) throw new Error(error.message)
  return (data??[]) as CrmPipelineStage[]
}

export async function listLeads() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const { data, error } = await db.from('leads').select('*').eq('organization_id', organizationId).is('archived_at',null).order('position').order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RealLead[]
}

export async function createPatientAndLead(input: {
  name:string; socialName?:string; phone:string; whatsapp?:string; email?:string; cpf?:string; rg?:string
  birthDate?:string; gender?:string; postalCode?:string; addressLine?:string; addressNumber?:string
  addressComplement?:string; neighborhood?:string; city?:string; stateCode?:string; source:string
  stage:LeadStage; stageId?:string; notes?:string; serviceInterest?:string; professionalId?:string
  serviceId?:string; unitId?:string; nextAction?:string; nextContactAt?:string
}) {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const {data,error}=await db.rpc('create_crm_contact',{contact:{
    organization_id:organizationId,full_name:input.name,social_name:input.socialName||null,phone:input.phone,
    whatsapp:input.whatsapp||input.phone,email:input.email||null,cpf:input.cpf||null,rg:input.rg||null,
    birth_date:input.birthDate||null,gender:input.gender||null,postal_code:input.postalCode||null,
    address_line:input.addressLine||null,address_number:input.addressNumber||null,address_complement:input.addressComplement||null,
    neighborhood:input.neighborhood||null,city:input.city||null,state_code:input.stateCode||null,
    source:input.source,stage_id:input.stageId||null,interest:input.serviceInterest||null,notes:input.notes||null,
    assigned_professional_id:input.professionalId||null,service_id:input.serviceId||null,unit_id:input.unitId||null,
    next_action:input.nextAction||null,next_contact_at:input.nextContactAt||null,
  }})
  if (error) throw new Error(error.message)
  return data as {patient_id:string;lead_id:string}
}

export async function getContactDetail(patientId:string) {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const [patient,lead]=await Promise.all([
    db.from('patient_profiles').select('*').eq('organization_id',organizationId).eq('id',patientId).single(),
    db.from('leads').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('updated_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(patient.error||lead.error)throw new Error((patient.error||lead.error)!.message)
  const [records,appointments,conversations,interactions,stageHistory,finance]=await Promise.all([
    db.from('patient_records').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('created_at',{ascending:false}),
    db.from('appointments').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('starts_at',{ascending:false}),
    db.from('conversations').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('updated_at',{ascending:false}),
    db.from('crm_interactions').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('occurred_at',{ascending:false}),
    lead.data?.id?db.from('crm_lead_stage_history').select('*,from_stage:crm_pipeline_stages!crm_lead_stage_history_from_stage_id_fkey(name),to_stage:crm_pipeline_stages!crm_lead_stage_history_to_stage_id_fkey(name)').eq('organization_id',organizationId).eq('lead_id',lead.data.id).order('changed_at',{ascending:false}):Promise.resolve({data:[],error:null}),
    db.from('financial_entries').select('*').eq('organization_id',organizationId).eq('patient_id',patientId).order('created_at',{ascending:false}),
  ])
  const error=records.error||appointments.error||conversations.error||interactions.error||stageHistory.error||finance.error
  if(error) throw new Error(error.message)
  return {patient:patient.data,lead:lead.data,records:records.data??[],appointments:appointments.data??[],conversations:conversations.data??[],interactions:interactions.data??[],stageHistory:stageHistory.data??[],finance:finance.data??[]}
}

export async function updateContact(patientId:string,input:{name:string;socialName?:string;phone:string;whatsapp?:string;email?:string;cpf?:string;rg?:string;birthDate?:string;gender?:string;postalCode?:string;addressLine?:string;addressNumber?:string;addressComplement?:string;neighborhood?:string;city?:string;stateCode?:string;notes?:string}) {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const payload={full_name:input.name.trim(),social_name:input.socialName?.trim()||null,phone:input.phone.trim(),whatsapp:input.whatsapp?.trim()||input.phone.trim(),email:input.email?.trim()||null,cpf:input.cpf?.replace(/\D/g,'')||null,rg:input.rg?.trim()||null,birth_date:input.birthDate||null,gender:input.gender||null,postal_code:input.postalCode?.replace(/\D/g,'')||null,address_line:input.addressLine?.trim()||null,address_number:input.addressNumber?.trim()||null,address_complement:input.addressComplement?.trim()||null,neighborhood:input.neighborhood?.trim()||null,city:input.city?.trim()||null,state_code:input.stateCode?.trim().toUpperCase()||null,notes:input.notes?.trim()||null}
  const {error}=await db.from('patient_profiles').update(payload).eq('organization_id',organizationId).eq('id',patientId)
  if(error) throw new Error(error.message)
  const {error:leadError}=await db.from('leads').update({full_name:payload.full_name,phone:payload.phone,email:payload.email}).eq('organization_id',organizationId).eq('patient_id',patientId)
  if(leadError) throw new Error(leadError.message)
}

export async function updateLeadStage(id: string, status: LeadStage) {
  const { error } = await client().from('leads').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function moveLeadToStage(id:string,stageId:string,position?:number) {
  const {error}=await client().rpc('move_crm_lead',{target_lead_id:id,target_stage_id:stageId,target_position:position??null})
  if(error) throw new Error(error.message)
}

export async function listPatients(search='',page=0,pageSize=50) {
  const { data, error } = await client().rpc('search_crm_patients',{search_text:search,page_offset:page*pageSize,page_limit:pageSize})
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function findDuplicateContacts(input:{cpf?:string;phone?:string;whatsapp?:string;email?:string}) {
  const {data,error}=await client().rpc('find_duplicate_crm_contacts',{
    contact_cpf:input.cpf||null,contact_phone:input.phone||null,contact_whatsapp:input.whatsapp||null,contact_email:input.email||null,
  })
  if(error) throw new Error(error.message)
  return data??[]
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
  id:string; type:FinancialEntryType; status:'pending'|'partially_paid'|'paid'|'overdue'|'cancelled'|'refunded'
  category:string; description:string; amount_cents:number; due_date:string|null
  paid_at:string|null; payment_method:string|null; recurring:boolean; created_at:string
  received_amount_cents:number; financial_fee_cents:number; net_received_cents:number
  category_id:string|null; payment_method_id:string|null; cash_account_id:string|null; cost_center_id:string|null
}

export interface FinancialCategory {id:string;name:string;kind:'revenue'|'direct_cost'|'operating_expense'|'personnel'|'marketing'|'administrative'|'infrastructure'|'tax'|'financial_fee'}
export interface PaymentMethod {id:string;name:string;method_type:string;percentage_fee:number;fixed_fee_cents:number;settlement_days:number;max_installments:number}
export interface CashAccount {id:string;name:string;account_type:string;opening_balance_cents:number}
export interface CostCenter {id:string;name:string;center_type:string}
export interface ProfessionalPayout {id:string;professional_id:string;payout_amount_cents:number;gross_amount_cents:number;status:'forecast'|'pending_release'|'released'|'paid'|'cancelled';due_date:string|null;paid_at:string|null;professional_profiles:{full_name:string}|null}

export async function listFinanceDictionaries() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const [categories,methods,accounts,centers]=await Promise.all([
    db.from('financial_categories').select('id,name,kind').eq('organization_id',organizationId).eq('active',true).order('name'),
    db.from('payment_methods').select('id,name,method_type,percentage_fee,fixed_fee_cents,settlement_days,max_installments').eq('organization_id',organizationId).eq('active',true).order('name'),
    db.from('cash_accounts').select('id,name,account_type,opening_balance_cents').eq('organization_id',organizationId).eq('active',true).order('name'),
    db.from('cost_centers').select('id,name,center_type').eq('organization_id',organizationId).eq('active',true).order('name'),
  ])
  const failure=[categories.error,methods.error,accounts.error,centers.error].find(Boolean)
  if(failure) throw new Error(failure.message)
  return {categories:(categories.data??[]) as FinancialCategory[],methods:(methods.data??[]) as PaymentMethod[],accounts:(accounts.data??[]) as CashAccount[],centers:(centers.data??[]) as CostCenter[]}
}

export async function listProfessionalPayouts() {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db.from('professional_payouts').select('*,professional_profiles(full_name)').eq('organization_id',organizationId).order('created_at',{ascending:false})
  if(error) throw new Error(error.message)
  return (data??[]) as unknown as ProfessionalPayout[]
}

export async function recordFinancialPayment(input:{entryId:string;amount:number;paymentMethodId?:string;cashAccountId?:string;notes?:string}) {
  const amountCents=Math.round(input.amount*100)
  if(!Number.isFinite(input.amount)||!Number.isSafeInteger(amountCents)||amountCents<=0) throw new Error('Informe um valor de pagamento maior que zero.')
  const {data,error}=await client().rpc('record_financial_payment',{
    target_entry_id:input.entryId,payment_amount_cents:amountCents,
    target_payment_method_id:input.paymentMethodId||null,target_cash_account_id:input.cashAccountId||null,
    idempotency_key:crypto.randomUUID(),payment_notes:input.notes?.trim()||null,
  })
  if(error) throw new Error(error.message)
  return data as RealFinancialEntry
}

export async function savePaymentMethod(input:{id?:string;name:string;methodType:string;percentageFee:number;fixedFee:number;settlementDays:number;maxInstallments:number}) {
  const db=client(); const {organizationId}=await getCurrentOrganization()
  const name=input.name.trim(),fixedFeeCents=Math.round(input.fixedFee*100)
  if(name.length<2) throw new Error('Informe o nome da forma de pagamento.')
  if(!['cash','pix','debit_card','credit_card','boleto','bank_transfer','insurance','other'].includes(input.methodType)) throw new Error('Selecione um tipo de pagamento válido.')
  if(!Number.isFinite(input.percentageFee)||input.percentageFee<0||input.percentageFee>100) throw new Error('A taxa percentual deve ficar entre 0% e 100%.')
  if(!Number.isFinite(input.fixedFee)||fixedFeeCents<0) throw new Error('A taxa fixa não pode ser negativa.')
  if(!Number.isInteger(input.settlementDays)||input.settlementDays<0) throw new Error('O prazo de recebimento deve ser informado em dias inteiros.')
  if(!Number.isInteger(input.maxInstallments)||input.maxInstallments<1) throw new Error('Informe pelo menos uma parcela.')
  const payload={organization_id:organizationId,name,method_type:input.methodType,percentage_fee:input.percentageFee,fixed_fee_cents:fixedFeeCents,settlement_days:input.settlementDays,max_installments:input.maxInstallments,active:true}
  const result=input.id?await db.from('payment_methods').update(payload).eq('organization_id',organizationId).eq('id',input.id):await db.from('payment_methods').insert(payload)
  if(result.error) throw new Error(result.error.code==='23505'?'Já existe uma forma de pagamento com esse nome.':result.error.message)
}

export async function listFinancialEntries() {
  const db = client()
  const { organizationId } = await getCurrentOrganization()
  const today=new Date().toISOString().slice(0,10)
  const {error:overdueError}=await db.from('financial_entries').update({status:'overdue'}).eq('organization_id',organizationId).eq('status','pending').lt('due_date',today)
  if(overdueError) throw new Error(overdueError.message)
  const { data, error } = await db.from('financial_entries').select('*').eq('organization_id', organizationId).order('created_at', { ascending:false })
  if (error) throw new Error(error.message)
  return (data ?? []) as RealFinancialEntry[]
}

export async function createFinancialEntry(input: { type:FinancialEntryType; category:string; description:string; amount:number; dueDate?:string; status?:RealFinancialEntry['status']; paymentMethod?:string; recurring?:boolean; categoryId?:string; paymentMethodId?:string; cashAccountId?:string; costCenterId?:string }) {
  const db = client()
  const { organizationId, userId } = await getCurrentOrganization()
  const requestedStatus = input.status ?? 'pending',amountCents=Math.round(input.amount*100)
  if(!input.description.trim()) throw new Error('Informe a descrição do lançamento.')
  if(!Number.isFinite(input.amount)||!Number.isSafeInteger(amountCents)||amountCents<=0) throw new Error('Informe um valor financeiro maior que zero.')
  const initialStatus=requestedStatus==='paid'?'pending':requestedStatus
  const { data, error } = await db.from('financial_entries').insert({
    organization_id: organizationId, type: input.type, status:initialStatus, category: input.category.trim(),
    description: input.description.trim(), amount_cents:amountCents,gross_amount_cents:amountCents,
    competence_date:input.dueDate||new Date().toISOString().slice(0,10),due_date: input.dueDate || null, paid_at:null,
    payment_method: input.paymentMethod || null, recurring: Boolean(input.recurring), created_by: userId,
    category_id:input.categoryId||null,payment_method_id:input.paymentMethodId||null,cash_account_id:input.cashAccountId||null,cost_center_id:input.costCenterId||null,
  }).select('id').single()
  if (error) throw new Error(error.message)
  if(requestedStatus==='paid'&&amountCents>0) await recordFinancialPayment({entryId:data.id,amount:input.amount,paymentMethodId:input.paymentMethodId,cashAccountId:input.cashAccountId,notes:'Baixa registrada na criação do lançamento'})
}

export async function updateFinancialEntry(id:string,input:{type:FinancialEntryType;category:string;description:string;amount:number;dueDate?:string;status:RealFinancialEntry['status'];paymentMethod?:string;recurring?:boolean;categoryId?:string;paymentMethodId?:string;cashAccountId?:string;costCenterId?:string}) {
  const status=input.status
  const amountCents=Math.round(input.amount*100)
  if(!input.description.trim()) throw new Error('Informe a descrição do lançamento.')
  if(!Number.isFinite(input.amount)||!Number.isSafeInteger(amountCents)||amountCents<=0) throw new Error('Informe um valor financeiro maior que zero.')
  const {data:current,error:loadError}=await client().from('financial_entries').select('received_amount_cents,status,paid_at').eq('id',id).single()
  if(loadError) throw new Error(loadError.message)
  if(amountCents<(current.received_amount_cents||0)) throw new Error('O valor não pode ser menor que o total já pago.')
  if(status==='cancelled'&&(current.received_amount_cents||0)>0) throw new Error('Um lançamento com pagamentos não pode ser cancelado. Registre o estorno antes.')
  const {data,error}=await client().from('financial_entries').update({
    type:input.type,status,category:input.category.trim(),description:input.description.trim(),
    amount_cents:amountCents,gross_amount_cents:amountCents,due_date:input.dueDate||null,competence_date:input.dueDate||new Date().toISOString().slice(0,10),
    paid_at:status==='paid'?(current.paid_at||new Date().toISOString()):null,payment_method:input.paymentMethod||null,
    recurring:Boolean(input.recurring),category_id:input.categoryId||null,payment_method_id:input.paymentMethodId||null,
    cash_account_id:input.cashAccountId||null,cost_center_id:input.costCenterId||null,
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
  if(!Number.isFinite(openingBalance)||openingBalance<0) throw new Error('Informe um saldo inicial válido, igual ou maior que zero.')
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
  id:string; starts_at:string; ends_at:string; status:'scheduled'|'confirmed'|'waiting'|'in_service'|'completed'|'cancelled'|'no_show'|'rescheduled'
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
  const {error}=await client().rpc('record_appointment_payment',{target_appointment_id:appointment.id,payment_method_name:paymentMethod.trim()})
  if(error) throw new Error(error.message)
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
  if(!Number.isFinite(closingBalance)||closingBalance<0) throw new Error('Informe um saldo final válido, igual ou maior que zero.')
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

export async function rescheduleAppointment(id:string,startsAt:string,endsAt:string,reason?:string) {
  const db=client(); const {organizationId,userId}=await getCurrentOrganization()
  const {data:current,error:loadError}=await db.from('appointments').select('starts_at,ends_at,notes').eq('organization_id',organizationId).eq('id',id).single()
  if(loadError) throw new Error(loadError.message)
  const history=JSON.stringify({previous_starts_at:current.starts_at,previous_ends_at:current.ends_at,rescheduled_by:userId,rescheduled_at:new Date().toISOString(),reason:reason||null})
  const {error}=await db.from('appointments').update({starts_at:startsAt,ends_at:endsAt,status:'rescheduled',notes:[current.notes,reason?`Reagendamento: ${reason}`:'Reagendado',`[history:${history}]`].filter(Boolean).join('\n')}).eq('organization_id',organizationId).eq('id',id)
  if(error) throw new Error(error.message)
}

export async function createCrmInteraction(patientId:string,leadId:string|null,type:'note'|'call'|'email'|'whatsapp'|'meeting',summary:string) {
  const db=client();const {organizationId,userId}=await getCurrentOrganization()
  const {error}=await db.from('crm_interactions').insert({organization_id:organizationId,patient_id:patientId,lead_id:leadId,interaction_type:type,summary:summary.trim(),created_by:userId})
  if(error) throw new Error(error.message)
  if(leadId)await db.from('leads').update({last_interaction_at:new Date().toISOString()}).eq('organization_id',organizationId).eq('id',leadId)
}

export async function reviewAdminProspect(id:string,status:'approved'|'rejected'|'duplicate',publish=false) {
  const {error}=await client().rpc('admin_review_clinic_prospect',{target_id:id,new_review_status:status,publish})
  if(error) throw new Error(error.message)
}

export type ResearchTarget={id:string;city:string;state_code:string;specialty:string;enabled:boolean;priority:number;last_run_at:string|null;last_status:string|null;last_result_count:number;city_rank:number|null}
export type ResearchRun={id:string;source_name:string;status:string;fetched_count:number;inserted_count:number;updated_count:number;error_message:string|null;started_at:string;finished_at:string|null;professional_research_targets:{city:string;state_code:string;specialty:string}|null}

export async function listResearchTargets(){const {data,error}=await client().from('professional_research_targets').select('*').order('priority').limit(500);if(error)throw error;return (data||[]) as ResearchTarget[]}
export async function listResearchRuns(){const {data,error}=await client().from('professional_research_runs').select('*,professional_research_targets(city,state_code,specialty)').order('started_at',{ascending:false}).limit(30);if(error)throw error;return (data||[]) as ResearchRun[]}
export async function setResearchTargetEnabled(id:string,enabled:boolean){const {error}=await client().from('professional_research_targets').update({enabled}).eq('id',id);if(error)throw error}
export async function runProfessionalResearch(action:'run'|'seed'='run'){
  const db=client();const {data}=await db.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error('Sessão administrativa expirada.')
  const response=await fetch('/api/professional-research-run',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({action})})
  const raw=await response.text();let payload:any
  try{payload=raw?JSON.parse(raw):{}}catch{throw new Error(`O servidor respondeu em formato inválido (HTTP ${response.status}). Atualize a página e tente novamente.`)}
  if(!response.ok)throw new Error(payload.error||`Falha ao executar pesquisa (HTTP ${response.status}).`);return payload
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

export async function searchProfessionalDirectoryByCity(specialtySlug:string,citySlug:string,page=1,pageSize=20) {
  const {data,error}=await client().rpc('directory_search_by_city',{requested_specialty_slug:specialtySlug,requested_city_slug:citySlug,requested_page:page,requested_page_size:pageSize})
  if(error) throw new Error(error.message)
  return (data??[]) as DirectoryProfessional[]
}

export async function listDirectoryFallbackByCity(specialtySlug:string,citySlug:string) {
  const {data,error}=await client().rpc('directory_fallback_by_city',{requested_specialty_slug:specialtySlug,requested_city_slug:citySlug})
  if(error) throw new Error(error.message)
  return (data??[]) as DirectoryProfessional[]
}

export async function getDirectoryProfessional(id:string) {
  const {data,error}=await client().from('published_clinic_directory').select('*').eq('id',id).maybeSingle()
  if(error) throw new Error(error.message)
  return data as DirectoryProfessional|null
}

export async function listMarketplaceProfessionals(specialty='',city='') {
  const db=client()
  const directoryPromise=(async()=>{
    if(!specialty||!city)return db.from('published_clinic_directory').select('*').order('plan_type',{ascending:false}).order('name')
    const specialtySlug=specialty.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    const citySlug=city.split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    const collected:any[]=[];let page=1;let total=1
    while(collected.length<total&&page<=20){const result=await db.rpc('directory_search_by_city',{requested_specialty_slug:specialtySlug,requested_city_slug:citySlug,requested_page:page,requested_page_size:50});if(result.error)return result;const batch=result.data??[];collected.push(...batch);total=Number(batch[0]?.total_count??collected.length);if(!batch.length)break;page+=1}
    return {data:collected,error:null}
  })()
  const [profilesResult,directoryResult]=await Promise.all([
    db.from('marketplace_professionals').select('*').order('verified',{ascending:false}).order('full_name'),
    directoryPromise,
  ])
  if(profilesResult.error) throw new Error(profilesResult.error.message)
  if(directoryResult.error) throw new Error(directoryResult.error.message)
  const profiles=(profilesResult.data??[]).map(item=>({...item,directory_profile:false}))
  const profileIds=new Set(profiles.map(item=>item.id))
  const directory=(directoryResult.data??[]).filter(item=>!profileIds.has(item.id)).map(item=>({
    id:item.id,full_name:item.name,clinic_name:null,verified:false,rating:0,review_count:0,
    specialties:[item.primary_specialty],city:item.city,state_code:item.state_code,
    neighborhood:item.neighborhood,whatsapp:null,directory_profile:true,
  }))
  return [...profiles,...directory]
}

export async function listNearbyMarketplaceProfessionals(specialty:string,city:string) {
  const query=new URLSearchParams({specialty,city,radius:'30'})
  const response=await fetch(`/api/directory-nearby?${query}`)
  const payload=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(payload.error||'Não foi possível buscar profissionais próximos.')
  return (payload.professionals??[]) as any[]
}

export async function recordProfessionalProfileView(professionalId:string) {
  const {error}=await client().rpc('record_professional_profile_view',{target_professional_id:professionalId})
  if(error) throw new Error(error.message)
}

export type PublicProfessionalReview={id:string;reviewer_name:string;rating:number;comment:string|null;created_at:string}

export async function listProfessionalReviews(professionalId:string) {
  const {data,error}=await client().from('public_professional_reviews').select('*').eq('professional_id',professionalId).order('created_at',{ascending:false}).limit(30)
  if(error) throw new Error(error.message)
  return (data??[]) as PublicProfessionalReview[]
}

export async function submitProfessionalReview(input:{professionalId:string;name:string;email:string;rating:number;comment:string}) {
  const {error}=await client().rpc('submit_professional_review',{
    target_professional_id:input.professionalId,
    reviewer_name:input.name.trim(),reviewer_email:input.email.trim().toLowerCase(),
    review_rating:input.rating,review_comment:input.comment.trim()||null,
  })
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

export async function getProfessionalServiceCities(professionalId:string) {
  const {data,error}=await client().from('professional_service_cities').select('city,state_code').eq('professional_id',professionalId).eq('active',true).order('is_primary',{ascending:false}).order('city')
  if(error) throw new Error(error.message)
  return (data??[]).map(item=>`${item.city}, ${item.state_code}`)
}

export async function saveProfessionalServiceCities(professionalId:string,cities:string[]) {
  const unique=[...new Set(cities.map(item=>item.trim()).filter(Boolean))]
  if(!unique.length) throw new Error('Informe ao menos uma cidade de divulgação.')
  const rows=unique.map((label,index)=>{const parts=label.split(',').map(item=>item.trim());const state=parts.at(-1)||'';if(parts.length<2||state.length!==2)throw new Error(`Selecione novamente a cidade "${label}".`);return {professional_id:professionalId,city:parts.slice(0,-1).join(', '),state_code:state.toUpperCase(),is_primary:index===0,active:true}})
  const db=client();const removed=await db.from('professional_service_cities').delete().eq('professional_id',professionalId);if(removed.error)throw new Error(removed.error.message)
  const {error}=await db.from('professional_service_cities').insert(rows);if(error)throw new Error(error.message)
}

export interface ProfessionalServiceLocation {
  id?:string
  name:string
  address_line:string
  address_number:string
  address_complement:string
  neighborhood:string
  city:string
  state_code:string
  postal_code:string
}

export async function getProfessionalServiceLocations(professionalId:string) {
  const {data,error}=await client().from('professional_service_locations').select('id,name,address_line,address_number,address_complement,neighborhood,city,state_code,postal_code').eq('professional_id',professionalId).eq('active',true).order('sort_order').order('name')
  if(error) throw new Error(error.message)
  return (data??[]) as ProfessionalServiceLocation[]
}

export async function saveProfessionalServiceLocations(professionalId:string,locations:ProfessionalServiceLocation[]) {
  const rows=locations.map((location,index)=>({
    professional_id:professionalId,name:location.name.trim(),address_line:location.address_line.trim(),
    address_number:location.address_number.trim()||null,address_complement:location.address_complement.trim()||null,
    neighborhood:location.neighborhood.trim()||null,city:location.city.trim(),state_code:location.state_code.trim().toUpperCase(),
    postal_code:location.postal_code.trim()||null,sort_order:index,active:true,
  })).filter(location=>location.name&&location.address_line&&location.city&&location.state_code.length===2)
  if(rows.length!==locations.length) throw new Error('Preencha nome, endereço, cidade e UF de todos os locais de atendimento.')
  const {data,error}=await client().rpc('save_professional_service_locations',{p:professionalId,rows:rows.map((row,index)=>({...row,id:locations[index]?.id||null}))})
  if(error) throw new Error(error.message)
  return (data??[]) as ProfessionalServiceLocation[]
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
