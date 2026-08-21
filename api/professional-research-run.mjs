import { adminClient } from './_lib/supabase-admin.mjs'
import { json } from './_lib/http.mjs'

const SOURCE = 'OpenStreetMap/Overpass'
const USER_AGENT = 'MaterPlaceDirectoryBot/1.0 (https://materplace.com.br/contato)'

export function slugify(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function normalizeBrazilPhone(value = '') {
  let digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')
  if (!digits.startsWith('55')) digits = `55${digits}`
  return /^55\d{10,11}$/.test(digits) ? digits : null
}

export function overpassQuery({ city, state_code, specialty }) {
  const safe = String(specialty).replace(/["\\]/g, '')
  return `[out:json][timeout:120];area["name"="${city}"]["boundary"="administrative"]->.city;(nwr(area.city)["healthcare"]["name"~"${safe}",i];nwr(area.city)["amenity"~"clinic|doctors|hospital"]["name"~"${safe}",i];nwr(area.city)["healthcare:speciality"~"${safe}",i];);out center tags;`
}

function sourceUrl(item) { return `https://www.openstreetmap.org/${item.type}/${item.id}` }
function displayName(item) { return item.tags?.name || item.tags?.operator || item.tags?.brand || '' }

export function mapOsmItem(item, target) {
  const name = displayName(item).trim()
  if (!name) return null
  const tags = item.tags || {}
  const safeTags = Object.fromEntries(Object.entries(tags).filter(([key]) => ![
    'addr:street','addr:housenumber','addr:unit','addr:postcode','contact:email','email',
  ].includes(key)))
  return {
    name,
    primary_specialty: target.specialty,
    specialty_slug: target.specialty_slug || slugify(target.specialty),
    city: target.city,
    city_slug: target.city_slug || slugify(target.city),
    neighborhood: tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district'] || null,
    state_code: target.state_code,
    whatsapp: normalizeBrazilPhone(tags['contact:whatsapp'] || tags.whatsapp || tags['contact:phone'] || tags.phone),
    source_url: sourceUrl(item),
    source_name: SOURCE,
    source_record_id: `${item.type}/${item.id}`,
    source_checked_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    source_payload: { osm_type: item.type, osm_id: item.id, tags: safeTags },
  }
}

function authorized(req) {
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) return false
  return req.headers.authorization === `Bearer ${expected}`
}

async function collect(target) {
  const response = await fetch(process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
    body: new URLSearchParams({ data: overpassQuery(target) }), signal: AbortSignal.timeout(150000),
  })
  if (!response.ok) throw new Error(`Fonte pública respondeu HTTP ${response.status}`)
  const payload = await response.json()
  return (payload.elements || []).map(item => mapOsmItem(item, target)).filter(Boolean)
}

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return json(res,405,{error:'Método não permitido.'})
  if (!authorized(req)) return json(res,401,{error:'Execução não autorizada.'})
  const db = adminClient()
  const { data: target, error: targetError } = await db.from('professional_research_targets').select('*')
    .eq('enabled',true).order('priority').order('last_run_at',{ascending:true,nullsFirst:true}).limit(1).maybeSingle()
  if (targetError) return json(res,500,{error:targetError.message})
  if (!target) return json(res,200,{ok:true,message:'Nenhum alvo habilitado.'})
  const { data: run, error: runError } = await db.from('professional_research_runs')
    .insert({target_id:target.id,source_name:SOURCE,status:'running'}).select('id').single()
  if (runError) return json(res,500,{error:runError.message})
  try {
    const rows = await collect(target); let inserted = 0; let updated = 0
    for (const row of rows) {
      const canonical = `${row.name}|${row.city}|${row.state_code}`.toLowerCase().replace(/[^a-z0-9]+/g,'')
      const { data: existing } = await db.from('clinic_prospects').select('id').eq('canonical_key',canonical).maybeSingle()
      if (existing) {
        const { error } = await db.from('clinic_prospects').update(row).eq('id',existing.id)
        if (error) throw error; updated += 1
      } else {
        const { error } = await db.from('clinic_prospects').insert(row)
        if (error) throw error; inserted += 1
      }
    }
    await Promise.all([
      db.from('professional_research_runs').update({status:'completed',fetched_count:rows.length,inserted_count:inserted,updated_count:updated,finished_at:new Date().toISOString()}).eq('id',run.id),
      db.from('professional_research_targets').update({last_run_at:new Date().toISOString(),last_status:'completed',last_result_count:rows.length}).eq('id',target.id),
    ])
    return json(res,200,{ok:true,target:`${target.specialty} em ${target.city}/${target.state_code}`,fetched:rows.length,inserted,updated,review:'Todos permanecem privados até aprovação humana.'})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida'
    await Promise.all([
      db.from('professional_research_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString()}).eq('id',run.id),
      db.from('professional_research_targets').update({last_run_at:new Date().toISOString(),last_status:'failed'}).eq('id',target.id),
    ])
    return json(res,502,{error:message})
  }
}
