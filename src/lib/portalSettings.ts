import { supabase } from './supabase'
function requireSupabase(){if(!supabase)throw new Error('Supabase não configurado.');return supabase}
export type EditorialStaff={responsibleJournalist:string;technicalConsultant:string}
export const defaultEditorialStaff:EditorialStaff={responsibleJournalist:'Paulo Roberto Dias',technicalConsultant:'Jéssica Calegari'}
export async function getEditorialStaff(){const {data,error}=await requireSupabase().from('portal_settings').select('value').eq('key','editorial_staff').maybeSingle();if(error)throw error;return{...defaultEditorialStaff,...((data?.value||{}) as Partial<EditorialStaff>)}}
export async function saveEditorialStaff(value:EditorialStaff){const {error}=await requireSupabase().from('portal_settings').upsert({key:'editorial_staff',value,updated_at:new Date().toISOString()});if(error)throw error}
