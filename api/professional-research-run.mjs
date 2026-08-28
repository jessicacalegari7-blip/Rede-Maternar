import { adminClient, requirePlatformAdmin } from './_lib/supabase-admin.mjs'
import { json } from './_lib/http.mjs'

const SOURCE = 'OpenStreetMap/Overpass'
const USER_AGENT = 'MaterPlaceDirectoryBot/1.0 (https://materplace.com.br/contato)'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const MAX_GOOGLE_PAGES = 3

const SPECIALTY_ALIASES = new Map([
  ['neuropediatra', { name: 'Neurologista Infantil', slug: 'neurologista-infantil' }],
  ['neuropediatria', { name: 'Neurologista Infantil', slug: 'neurologista-infantil' }],
  ['neurologia-pediatrica', { name: 'Neurologista Infantil', slug: 'neurologista-infantil' }],
  ['neurologista-pediatrico', { name: 'Neurologista Infantil', slug: 'neurologista-infantil' }],
  ['gastro-pediatra', { name: 'Gastroenterologista Infantil', slug: 'gastroenterologista-infantil' }],
  ['gastropediatra', { name: 'Gastroenterologista Infantil', slug: 'gastroenterologista-infantil' }],
  ['gastroenterologia-pediatrica', { name: 'Gastroenterologista Infantil', slug: 'gastroenterologista-infantil' }],
  ['fono-infantil', { name: 'Fonoaudiologa Infantil', slug: 'fonoaudiologa-infantil' }],
  ['fonoaudiologia-infantil', { name: 'Fonoaudiologa Infantil', slug: 'fonoaudiologa-infantil' }],
  ['pediatria', { name: 'Pediatra', slug: 'pediatra' }],
])

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

export function canonicalSpecialty(name = '', slug = '') {
  const key = slugify(slug || name)
  return SPECIALTY_ALIASES.get(key) || { name: String(name).trim(), slug: key }
}

function withCanonicalSpecialty(row, target) {
  const specialty = canonicalSpecialty(target.specialty, target.specialty_slug)
  return { ...row, primary_specialty: specialty.name, specialty_slug: specialty.slug }
}

export function overpassQuery({ city, state_code, specialty }) {
  const normalized = slugify(specialty)
  const aliases = normalized.includes('pediatr')
    ? 'pediatr|paediatr|infantil|crianca'
    : normalized.includes('amament')
      ? 'amament|lacta'
      : normalized.split('-').filter(part => part.length > 3).join('|')
  const safe = aliases.replace(/["\\]/g, '')
  return `[out:json][timeout:45];area["name"="${city}"]["boundary"="administrative"]["admin_level"="8"]->.city;(nwr(area.city)["healthcare:speciality"~"${safe}",i];nwr(area.city)["name"~"${safe}",i]["amenity"~"clinic|doctors|hospital"];nwr(area.city)["name"~"${safe}",i]["healthcare"];);out center tags 200;`
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
    primary_specialty: canonicalSpecialty(target.specialty, target.specialty_slug).name,
    specialty_slug: canonicalSpecialty(target.specialty, target.specialty_slug).slug,
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

function nominatimQueries(target) {
  const specialty = target.specialty || ''
  const normalized = slugify(specialty)
  const terms = normalized.includes('pediatr')
    ? [specialty, 'clinica pediatrica', 'pediatra', 'hospital infantil']
    : normalized.includes('amament')
      ? [specialty, 'consultoria de amamentacao', 'lactacao']
      : [specialty]
  return [...new Set(terms.map(term => `${term} ${target.city} ${target.state_code} Brasil`))]
}

function mapNominatimItem(item, target) {
  const name = String(item.name || item.display_name || '').split(',')[0].trim()
  if (!name || !item.osm_type || !item.osm_id) return null
  const address = item.address || {}
  const extras = item.extratags || {}
  const osmType = String(item.osm_type).toLowerCase() === 'node'
    ? 'node'
    : String(item.osm_type).toLowerCase() === 'way' ? 'way' : 'relation'
  return {
    name,
    primary_specialty: canonicalSpecialty(target.specialty, target.specialty_slug).name,
    specialty_slug: canonicalSpecialty(target.specialty, target.specialty_slug).slug,
    city: target.city,
    city_slug: target.city_slug || slugify(target.city),
    neighborhood: address.suburb || address.neighbourhood || address.city_district || null,
    state_code: target.state_code,
    whatsapp: normalizeBrazilPhone(extras['contact:whatsapp'] || extras.whatsapp || extras['contact:phone'] || extras.phone),
    source_url: `https://www.openstreetmap.org/${osmType}/${item.osm_id}`,
    source_name: 'OpenStreetMap/Nominatim',
    source_record_id: `${osmType}/${item.osm_id}`,
    source_checked_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    source_payload: { osm_type: osmType, osm_id: item.osm_id, category: item.category, type: item.type },
  }
}

async function collectFromNominatim(target) {
  const collected = new Map()
  for (const query of nominatimQueries(target)) {
    const url = new URL(NOMINATIM_URL)
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('extratags', '1')
    url.searchParams.set('countrycodes', 'br')
    url.searchParams.set('limit', '20')
    url.searchParams.set('q', query)
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) throw new Error(`Nominatim respondeu HTTP ${response.status}`)
    const payload = await response.json()
    for (const item of payload) {
      const row = mapNominatimItem(item, target)
      if (row) collected.set(row.source_record_id, row)
    }
    // A política pública do Nominatim limita clientes a uma solicitação por segundo.
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
  return [...collected.values()]
}

function cronAuthorized(req) {
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) return false
  return req.headers.authorization === `Bearer ${expected}`
}

function extractPublicBusinessPhone(html = '') {
  const whatsappLink = html.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|whatsapp:\/\/send\?phone=)(?:%2B|\+)?(55)?([1-9]{2}9?\d{8})/i)
  if (whatsappLink) return normalizeBrazilPhone(`${whatsappLink[1] || '55'}${whatsappLink[2]}`)
  const labeled = html.match(/(?:whats(?:app)?|fale\s+conosco)[^\d+]{0,80}(?:\+?55\s*)?\(?([1-9]{2})\)?[\s.-]*(9?\d{4})[\s.-]*(\d{4})/i)
  return labeled ? normalizeBrazilPhone(`55${labeled[1]}${labeled[2]}${labeled[3]}`) : null
}

async function verifyOfficialWebsite(place, target) {
  const website = String(place.websiteUri || '').trim()
  if (!website || !/^https?:\/\//i.test(website)) return null
  try {
    const response = await fetch(website, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: AbortSignal.timeout(9000),
    })
    if (!response.ok || !String(response.headers.get('content-type') || '').includes('text/html')) return null
    const html = (await response.text()).slice(0, 1_500_000)
    const whatsapp = extractPublicBusinessPhone(html)
    if (!whatsapp) return null
    const name = String(place.displayName?.text || '').trim()
    if (!name) return null
    return {
      name, primary_specialty: canonicalSpecialty(target.specialty, target.specialty_slug).name,
      specialty_slug: canonicalSpecialty(target.specialty, target.specialty_slug).slug,
      city: target.city, city_slug: target.city_slug || slugify(target.city),
      neighborhood: null, state_code: target.state_code, whatsapp,
      source_url: response.url || website,
      source_name: 'Site oficial público',
      source_record_id: place.id ? `google-place/${place.id}` : `website/${slugify(name)}`,
      source_checked_at: new Date().toISOString(), last_seen_at: new Date().toISOString(),
      source_payload: { google_place_id: place.id || null, verified_on_official_website: true },
      legal_basis_note: 'Contato profissional/empresarial divulgado publicamente no site oficial; uso restrito à prospecção B2B com opção de oposição.',
    }
  } catch { return null }
}

async function collectFromGooglePlaces(target) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return []
  const collected = new Map(); let pageToken = null
  for (let page = 0; page < MAX_GOOGLE_PAGES; page += 1) {
    const body = { textQuery: `${target.specialty} em ${target.city} ${target.state_code}, Brasil`, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 20 }
    if (pageToken) body.pageToken = pageToken
    const response = await fetch(GOOGLE_PLACES_URL, {
      method: 'POST', headers: {
        'content-type': 'application/json', 'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,nextPageToken',
      }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) throw new Error(`Google Places respondeu HTTP ${response.status}`)
    const payload = await response.json(); const places = payload.places || []
    for (let index = 0; index < places.length; index += 5) {
      const verified = await Promise.all(places.slice(index, index + 5).map(place => verifyOfficialWebsite(place, target)))
      verified.filter(Boolean).forEach(row => collected.set(row.source_url, row))
    }
    pageToken = payload.nextPageToken || null
    if (!pageToken) break
    await new Promise(resolve => setTimeout(resolve, 1200))
  }
  return [...collected.values()]
}


async function authorizedDatabase(req) {
  if (cronAuthorized(req)) return adminClient()
  return (await requirePlatformAdmin(req)).db
}

async function seedTargets(db) {
  const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios', { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`IBGE respondeu HTTP ${response.status}`)
  const municipalities = await response.json()
  const populationResponse = await fetch('https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-6/variaveis/9324?localidades=N6[all]', { signal: AbortSignal.timeout(60000) })
  if (!populationResponse.ok) throw new Error(`IBGE População respondeu HTTP ${populationResponse.status}`)
  const populationPayload = await populationResponse.json()
  const series = populationPayload?.[0]?.resultados?.[0]?.series || []
  const populationById = new Map(series.map(item => [String(item.localidade?.id), Number(Object.values(item.serie || {}).at(-1) || 0)]))
  const topCities = municipalities.map(city => ({city:city.nome,state_code:city.microrregiao?.mesorregiao?.UF?.sigla || city['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla,population:populationById.get(String(city.id))||0})).filter(city=>city.state_code).sort((a,b)=>b.population-a.population).slice(0,200)
  const { data: specialties, error: specialtiesError } = await db.from('specialties').select('name,slug').eq('active',true).order('name')
  if (specialtiesError) throw specialtiesError
  const rows = topCities.flatMap((city,cityIndex)=>(specialties||[]).map((specialty,specialtyIndex)=>({city:city.city,state_code:city.state_code,specialty:specialty.name,specialty_slug:specialty.slug,city_slug:slugify(city.city),city_population:city.population,city_rank:cityIndex+1,priority:(cityIndex+1)*100+specialtyIndex,enabled:true})))
  for (let index=0; index<rows.length; index+=500) {
    const { error } = await db.from('professional_research_targets').upsert(rows.slice(index,index+500),{onConflict:'specialty_slug,state_code,city_slug',ignoreDuplicates:false})
    if (error) throw error
  }
  return { cities:topCities.length,specialties:specialties?.length||0,targets:rows.length }
}

async function collect(target) {
  const googleRows = await collectFromGooglePlaces(target)
  const configured = process.env.OVERPASS_API_URL?.trim()
  const endpoints = [...new Set([
    configured,
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter',
  ].filter(Boolean))]
  const failures = []
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': USER_AGENT },
        body: new URLSearchParams({ data: overpassQuery(target) }), signal: AbortSignal.timeout(65000),
      })
      if (!response.ok) { failures.push(`${new URL(endpoint).host}: HTTP ${response.status}`); continue }
      const payload = await response.json()
      const rows = (payload.elements || []).map(item => mapOsmItem(item, target)).filter(Boolean)
      if (rows.length) return [...new Map([...googleRows, ...rows].map(row => [row.source_url, row])).values()]
      failures.push(`${new URL(endpoint).host}: nenhum resultado`)
    } catch (error) {
      failures.push(`${new URL(endpoint).host}: ${error instanceof Error ? error.message : 'falha'}`)
    }
  }
  try {
    const fallbackRows = await collectFromNominatim(target)
    if (fallbackRows.length) return [...new Map([...googleRows, ...fallbackRows].map(row => [row.source_url, row])).values()]
    failures.push('nominatim.openstreetmap.org: nenhum resultado')
  } catch (error) {
    failures.push(`nominatim.openstreetmap.org: ${error instanceof Error ? error.message : 'falha'}`)
  }
  if (googleRows.length) return googleRows
  throw new Error(`Fontes públicas indisponíveis (${failures.join('; ')})`)
}

async function processTarget(db, target) {
  const { data: run, error: runError } = await db.from('professional_research_runs')
    .insert({target_id:target.id,source_name:process.env.GOOGLE_MAPS_API_KEY?'Google Places + sites oficiais + OpenStreetMap':SOURCE,status:'running'}).select('id').single()
  if (runError) throw runError
  try {
    const collectedRows = await collect(target)
    const rows = collectedRows
      .map(row => withCanonicalSpecialty(row, target))
      .filter(row => Boolean(normalizeBrazilPhone(row.whatsapp)))
      .map(row => ({ ...row, whatsapp: normalizeBrazilPhone(row.whatsapp) }))
    let inserted = 0; let updated = 0
    for (const row of rows) {
      const canonical = `${row.name}|${row.city}|${row.state_code}`.toLowerCase().replace(/[^a-z0-9]+/g,'')
      const { data: existing } = await db.from('clinic_prospects').select('id').eq('canonical_key',canonical).maybeSingle()
      if (existing) { const { error } = await db.from('clinic_prospects').update(row).eq('id',existing.id); if (error) throw error; updated += 1 }
      else { const { error } = await db.from('clinic_prospects').insert(row); if (error) throw error; inserted += 1 }
    }
    await Promise.all([
      db.from('professional_research_runs').update({status:'completed',fetched_count:rows.length,inserted_count:inserted,updated_count:updated,finished_at:new Date().toISOString()}).eq('id',run.id),
      db.from('professional_research_targets').update({last_run_at:new Date().toISOString(),last_status:'completed',last_result_count:rows.length}).eq('id',target.id),
    ])
    return {target:`${target.specialty} em ${target.city}/${target.state_code}`,fetched:collectedRows.length,eligible:rows.length,inserted,updated}
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida'
    await Promise.all([
      db.from('professional_research_runs').update({status:'failed',error_message:message,finished_at:new Date().toISOString()}).eq('id',run.id),
      db.from('professional_research_targets').update({last_run_at:new Date().toISOString(),last_status:'failed'}).eq('id',target.id),
    ])
    return {target:`${target.specialty} em ${target.city}/${target.state_code}`,fetched:0,eligible:0,inserted:0,updated:0,error:message}
  }
}

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return json(res,405,{error:'Método não permitido.'})
  let db
  try { db = await authorizedDatabase(req) } catch (error) { return json(res,error.status||401,{error:error.message}) }
  if (req.method==='POST' && req.body?.action==='seed') {
    try { return json(res,200,{ok:true,...await seedTargets(db)}) }
    catch (error) { return json(res,502,{error:error instanceof Error?error.message:'Falha ao gerar fila.'}) }
  }
  const requestedBatch = Number(req.body?.batchSize || process.env.RESEARCH_TARGETS_PER_RUN || 3)
  const batchSize = Math.min(Math.max(Number.isFinite(requestedBatch)?requestedBatch:3,1),10)
  const { data: targets, error: targetError } = await db.from('professional_research_targets').select('*')
    .eq('enabled',true).order('last_run_at',{ascending:true,nullsFirst:true}).order('priority').limit(batchSize)
  if (targetError) return json(res,500,{error:targetError.message})
  if (!targets?.length) return json(res,200,{ok:true,message:'Nenhum alvo habilitado.'})
  const results=[]
  for (const target of targets) results.push(await processTarget(db,target))
  return json(res,200,{ok:true,batchSize:results.length,results,target:results.map(x=>x.target).join('; '),fetched:results.reduce((s,x)=>s+x.fetched,0),eligible:results.reduce((s,x)=>s+(x.eligible||0),0),inserted:results.reduce((s,x)=>s+x.inserted,0),updated:results.reduce((s,x)=>s+x.updated,0),publication:'Somente registros com WhatsApp profissional público validado são cadastrados; o número permanece privado no backoffice.'})
}
