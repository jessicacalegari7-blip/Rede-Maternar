import { getCurrentOrganization } from './operations'
import { supabase } from './supabase'

export type HealthPlan = {
  id:string; organization_id:string; patient_id:string; professional_id:string|null;
  category:string; title:string; description:string; frequency:string; goal:string;
  starts_on:string; ends_on:string|null; notes:string;
  status:'ativo'|'concluído'|'pausado'|'cancelado'; created_at:string
}
export type HealthPlanEntry = {
  id:string; plan_id:string; patient_id:string; organization_id:string;
  observed_on:string; value:string; notes:string; created_at:string
}

function db() { if(!supabase) throw new Error('O banco de dados está indisponível.'); return supabase }

export async function listHealthPlans(patientId:string) {
  const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db().from('patient_health_plans').select('id,organization_id,patient_id,professional_id,category,title,description,frequency,goal,starts_on,ends_on,notes,status,created_at').eq('organization_id',organizationId).eq('patient_id',patientId).order('created_at',{ascending:false}).limit(100)
  if(error)throw new Error(error.message)
  return(data||[]) as HealthPlan[]
}

export async function listHealthPlanEntries(patientId:string) {
  const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db().from('patient_health_plan_entries').select('id,plan_id,patient_id,organization_id,observed_on,value,notes,created_at').eq('organization_id',organizationId).eq('patient_id',patientId).order('observed_on',{ascending:false}).limit(100)
  if(error)throw new Error(error.message)
  return(data||[]) as HealthPlanEntry[]
}

export async function createHealthPlan(patientId:string,input:{category:string;title:string;description:string;frequency:string;goal:string;startsOn:string;endsOn:string;notes:string;professionalId?:string}) {
  const {organizationId,userId}=await getCurrentOrganization()
  const {error}=await db().from('patient_health_plans').insert({organization_id:organizationId,patient_id:patientId,professional_id:input.professionalId||null,category:input.category,title:input.title.trim(),description:input.description.trim(),frequency:input.frequency.trim(),goal:input.goal.trim(),starts_on:input.startsOn,ends_on:input.endsOn||null,notes:input.notes.trim(),created_by:userId})
  if(error)throw new Error(error.message)
}

export async function updateHealthPlanStatus(patientId:string,id:string,status:HealthPlan['status']) {
  const {organizationId}=await getCurrentOrganization()
  const {data,error}=await db().from('patient_health_plans').update({status}).eq('id',id).eq('patient_id',patientId).eq('organization_id',organizationId).select('id').single()
  if(error||!data)throw new Error(error?.message||'Plano não encontrado.')
}

export async function addHealthPlanEntry(patientId:string,planId:string,input:{observedOn:string;value:string;notes:string}) {
  const {organizationId,userId}=await getCurrentOrganization()
  const {error}=await db().from('patient_health_plan_entries').insert({organization_id:organizationId,patient_id:patientId,plan_id:planId,observed_on:input.observedOn,value:input.value.trim(),notes:input.notes.trim(),created_by:userId})
  if(error)throw new Error(error.message)
}
