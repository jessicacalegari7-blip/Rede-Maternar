import { adminClient } from './_lib/supabase-admin.mjs'
import { json } from './_lib/http.mjs'

const USER_AGENT='MaterPlaceDirectory/1.0 (https://materplace.com.br/contato)'
const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const aliases=new Map([
  ['neuropediatra','neurologista-infantil'],['neuropediatria','neurologista-infantil'],['neurologia-pediatrica','neurologista-infantil'],
  ['gastropediatra','gastroenterologista-infantil'],['gastro-pediatra','gastroenterologista-infantil'],['pediatria','pediatra'],
])

export default async function handler(req,res){
  try{
    const specialty=aliases.get(slugify(req.query.specialty))||slugify(req.query.specialty)
    const city=String(req.query.city||'').trim();const radius=Math.min(Math.max(Number(req.query.radius)||30,1),30)
    if(!specialty||!city)return json(res,400,{error:'Especialidade e cidade são obrigatórias.'})
    const url=new URL('https://nominatim.openstreetmap.org/search');url.searchParams.set('format','jsonv2');url.searchParams.set('countrycodes','br');url.searchParams.set('limit','1');url.searchParams.set('q',`${city}, Brasil`)
    const geo=await fetch(url,{headers:{'user-agent':USER_AGENT,accept:'application/json'},signal:AbortSignal.timeout(12000)})
    if(!geo.ok)throw new Error('Não foi possível localizar a cidade informada.')
    const place=(await geo.json())[0];if(!place)return json(res,200,{professionals:[]})
    const db=adminClient();const {data,error}=await db.rpc('directory_nearby',{requested_specialty_slug:specialty,requested_latitude:Number(place.lat),requested_longitude:Number(place.lon),requested_radius_km:radius})
    if(error)throw error
    return json(res,200,{professionals:(data||[]).map(item=>({id:item.id,full_name:item.name,clinic_name:null,verified:false,rating:0,review_count:0,specialties:[item.primary_specialty],city:item.city,state_code:item.state_code,neighborhood:item.neighborhood,whatsapp:null,directory_profile:true,distance_km:item.distance_km}))})
  }catch(error){return json(res,500,{error:error instanceof Error?error.message:'Falha na busca por proximidade.'})}
}
