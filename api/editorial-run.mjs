import crypto from 'node:crypto'
import sharp from 'sharp'
import { adminClient } from './_lib/supabase-admin.mjs'

const OFFICIAL_DOMAINS = ['gov.br', 'who.int', 'paho.org', 'fiocruz.br', 'sbp.com.br', 'sbim.org.br', 'febrasgo.org.br', 'unicef.org']
const KEYWORDS = ['gestação', 'gravidez', 'gestante', 'maternidade', 'amamentação', 'bebê', 'recém-nascido', 'pediatria', 'parto', 'pós-parto', 'saúde da mulher', 'vacina infantil', 'bronquiolite', 'VSR', 'desenvolvimento infantil', 'primeira infância']

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`)
  if ([...value].some(character => character.codePointAt(0) > 255)) {
    throw new Error(`Credencial inválida ou mascarada na Vercel: ${name}`)
  }
  return value
}

function cleanText(value = '') {
  return value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim()
}

function decodeXml(value = '') {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function rssItems(xml, publisher = '') {
  return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(match => {
    const item = match[0]
    const field = name => decodeXml(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '')
    return { title: cleanText(field('title')), url: cleanText(field('link')), summary: cleanText(field('description')), publishedAt: cleanText(field('pubDate')), publisher: cleanText(field('source')) || publisher }
  }).filter(item => item.title && item.url)
}

async function fetchText(url, timeout = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'MaterPlaceEditorialBot/1.0 (+https://materplace.com.br)' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return { text: await response.text(), finalUrl: response.url }
  } finally { clearTimeout(timer) }
}

function keywordScore(text) {
  const normalized = text.toLocaleLowerCase('pt-BR')
  return KEYWORDS.reduce((score, keyword) => score + (normalized.includes(keyword.toLocaleLowerCase('pt-BR')) ? 8 : 0), 0)
}

async function discoverSources() {
  const query = encodeURIComponent(`(${KEYWORDS.slice(0, 12).join(' OR ')}) when:2d`)
  const feeds = [
    { url: `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`, publisher: 'Google News' },
    { url: 'https://agenciabrasil.ebc.com.br/rss/saude/feed.xml', publisher: 'Agência Brasil' },
  ]
  const discovered = []
  for (const feed of feeds) {
    try { discovered.push(...rssItems((await fetchText(feed.url)).text, feed.publisher)) } catch (error) { console.warn('feed_unavailable', feed.url, error.message) }
  }
  const officialIndexes = [
    { url: 'https://www.gov.br/saude/pt-br/assuntos/noticias-ms', publisher: 'Ministério da Saúde' },
    { url: 'https://portal.fiocruz.br/noticias', publisher: 'Fiocruz' },
  ]
  for (const index of officialIndexes) {
    try {
      const page = await fetchText(index.url)
      for (const match of page.text.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const title = cleanText(match[2]); if (title.length < 25 || keywordScore(title) < 8) continue
        const url = new URL(match[1], index.url).toString()
        if (!url.startsWith('http')) continue
        discovered.push({ title, url, summary: '', publishedAt: '', publisher: index.publisher })
      }
    } catch (error) { console.warn('official_index_unavailable', index.url, error.message) }
  }
  const ranked = discovered.map(item => ({ ...item, score: keywordScore(`${item.title} ${item.summary}`) + (Date.now() - Date.parse(item.publishedAt || 0) < 172800000 ? 15 : 0) }))
    .filter(item => item.score >= 8).sort((a, b) => b.score - a.score).slice(0, 12)
  const researched = []
  for (const item of ranked) {
    try {
      const page = await fetchText(item.url)
      const content = cleanText(page.text).slice(0, 9000)
      if (content.length < 500) continue
      const hostname = new URL(page.finalUrl).hostname.replace(/^www\./, '')
      researched.push({ ...item, url: page.finalUrl, hostname, content, sourceType: OFFICIAL_DOMAINS.some(domain => hostname.endsWith(domain)) ? 'primary' : 'press', trustLevel: OFFICIAL_DOMAINS.some(domain => hostname.endsWith(domain)) ? 5 : 3 })
    } catch (error) { console.warn('source_unavailable', item.url, error.message) }
    if (researched.length >= 6) break
  }
  return researched
}

function similarity(a, b) {
  const words = value => new Set(value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(word => word.length > 3))
  const left = words(a); const right = words(b); const intersection = [...left].filter(word => right.has(word)).length
  return intersection / Math.max(1, new Set([...left, ...right]).size)
}

async function callOpenAI(sources, existingTitles) {
  const sourcePacket = sources.map((source, index) => ({ id: index + 1, title: source.title, publisher: source.publisher, url: source.url, publication_date: source.publishedAt, source_type: source.sourceType, trust_level: source.trustLevel, excerpt: source.content.slice(0, 6000) }))
  const instructions = `Você é a redação jornalística da MaterPlace. Produza UMA matéria original em português brasileiro sobre saúde materno-infantil usando EXCLUSIVAMENTE os dados nas fontes fornecidas. Não invente números, datas, especialistas ou aspas. Não diagnostique nem prescreva. Priorize uma pauta com fonte primária e relevância prática para famílias. O texto deve ter 700 a 1500 palavras, lead, H2/H3, seção para famílias, ressalva médica quando aplicável e lista final de fontes com links. Nunca publique: status deve ser draft. Retorne JSON válido com: title, subtitle, slug, excerpt, content_html, category, tags, seo_title, meta_description, primary_keyword, secondary_keywords, long_tail_keywords, source_urls, image_prompt, image_alt, facts (array de objetos claim, status SUPPORTED, source_urls), editorial_score (70-100), why_now. Títulos já existentes que devem ser evitados: ${existingTitles.join(' | ')}`
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${required('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5-mini', messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify({ sources: sourcePacket }) }], response_format: { type: 'json_object' } }) })
  const body = await response.json()
  if (!response.ok) throw new Error(`OpenAI: ${body.error?.message || response.status}`)
  return JSON.parse(body.choices?.[0]?.message?.content || '{}')
}

function validateDraft(draft, sources, existingTitles) {
  const errors = []
  const sourceUrls = new Set(sources.map(source => source.url))
  if (!draft.title || !draft.slug || !draft.content_html || !draft.excerpt) errors.push('Campos editoriais obrigatórios ausentes')
  if (cleanText(draft.content_html || '').split(/\s+/).length < 650) errors.push('Texto abaixo do mínimo editorial')
  if (!Array.isArray(draft.source_urls) || draft.source_urls.length < 2) errors.push('Menos de duas fontes')
  if ((draft.source_urls || []).some(url => !sourceUrls.has(url))) errors.push('Fonte não pertencente ao dossiê')
  if (!sources.some(source => source.sourceType === 'primary')) errors.push('Fonte primária ausente')
  if (existingTitles.some(title => similarity(title, draft.title || '') > 0.8)) errors.push('Possível duplicidade')
  if (!Array.isArray(draft.facts) || draft.facts.some(fact => fact.status !== 'SUPPORTED' || !fact.source_urls?.length)) errors.push('Fact-check incompleto')
  if (Number(draft.editorial_score || 0) < Number(process.env.MIN_EDITORIAL_SCORE || 70)) errors.push('Score editorial insuficiente')
  return errors
}

async function generateImage(prompt, alt, runId) {
  const response = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${required('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt: `Fotografia editorial realista, acolhedora e contemporânea para portal brasileiro de saúde materno-infantil. ${prompt}. Sem texto, sem letras, sem logotipos, sem marcas, sem aparência de registro jornalístico de pessoa pública. Composição horizontal 16:9, luz natural, diversidade brasileira.`, size: '1536x1024', quality: 'medium' }) })
  const body = await response.json()
  if (!response.ok || !body.data?.[0]?.b64_json) throw new Error(`Imagem OpenAI: ${body.error?.message || response.status}`)
  const image = await sharp(Buffer.from(body.data[0].b64_json, 'base64')).resize(1600, 900, { fit: 'cover', position: 'attention' }).webp({ quality: 84 }).toBuffer()
  const path = `editorial/${new Date().toISOString().slice(0, 10)}/${runId}.webp`
  const upload = await fetch(`${required('SUPABASE_URL')}/storage/v1/object/news-media/${path}`, { method: 'POST', headers: { apikey: required('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${required('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'image/webp', 'x-upsert': 'false', 'x-image-alt': encodeURIComponent(alt) }, body: image })
  if (!upload.ok) throw new Error(`Storage: ${upload.status} ${await upload.text()}`)
  return `${required('SUPABASE_URL')}/storage/v1/object/public/news-media/${path}`
}

async function executeRun() {
  const db = adminClient()
  const { count } = await db.from('editorial_article_audits').select('id', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  if ((count || 0) >= Number(process.env.MAX_ARTICLES_PER_DAY || 3)) return { status: 'daily_limit_reached' }
  const { data: run, error: runError } = await db.from('editorial_runs').insert({ status: 'running', metrics: { trigger: 'vercel-cron' } }).select('id').single()
  if (runError) throw runError
  try {
    const sources = await discoverSources()
    if (sources.length < 2 || !sources.some(source => source.sourceType === 'primary')) throw new Error('Nenhuma pauta com fontes suficientes e fonte primária foi encontrada')
    const { data: existing } = await db.from('news_articles').select('title').order('created_at', { ascending: false }).limit(100)
    const draft = await callOpenAI(sources, (existing || []).map(row => row.title))
    const errors = validateDraft(draft, sources, (existing || []).map(row => row.title))
    if (errors.length) throw new Error(`QualityGate FAILED: ${errors.join('; ')}`)
    const topicHash = crypto.createHash('sha256').update(draft.title.trim().toLocaleLowerCase('pt-BR')).digest('hex')
    const { data: topic, error: topicError } = await db.from('editorial_topics').upsert({ title: draft.title, why_now: draft.why_now || '', editorial_score: draft.editorial_score, status: 'selected', topic_hash: topicHash, metadata: { primary_keyword: draft.primary_keyword } }, { onConflict: 'topic_hash', ignoreDuplicates: false }).select('id').single()
    if (topicError) throw topicError
    const coverImageUrl = await generateImage(draft.image_prompt, draft.image_alt, run.id)
    const articlePayload = { slug: draft.slug, title: draft.title, seo_title: draft.seo_title || draft.title, excerpt: draft.excerpt, content: draft.content_html, category: draft.category || 'Saúde', cover_image_url: coverImageUrl, author_name: 'Redação MaterPlace — revisão humana pendente', status: 'draft', featured: false, published_at: null, is_demo: false }
    const { data: article, error: articleError } = await db.from('news_articles').insert(articlePayload).select('id,slug,status').single()
    if (articleError) throw articleError
    await db.from('editorial_article_audits').insert({ article_id: article.id, topic_id: topic.id, run_id: run.id, research_dossier: { topic: draft.title, why_now: draft.why_now, sources }, source_urls: draft.source_urls, fact_check: draft.facts, quality_gate: 'PASS', technical_review_pending: true, generated_by_ai: true, model_name: process.env.OPENAI_MODEL || 'gpt-5-mini', prompt_version: 'materplace-master-v1-live', warnings: [], })
    await db.from('editorial_runs').update({ status: 'completed', finished_at: new Date().toISOString(), metrics: { sources: sources.length, articles_created: 1, image: { width: 1600, height: 900, alt: draft.image_alt } } }).eq('id', run.id)
    return { status: 'draft_created', article: { ...article, image_alt: draft.image_alt }, quality_gate: 'PASS' }
  } catch (error) {
    await db.from('editorial_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: String(error.message || error).slice(0, 1500) }).eq('id', run.id)
    throw error
  }
}

export default async function handler(request, response) {
  if (!['GET', 'POST'].includes(request.method)) return response.status(405).json({ error: 'Método não permitido' })
  if (request.headers.authorization !== `Bearer ${required('CRON_SECRET')}`) return response.status(401).json({ error: 'Não autorizado' })
  try { return response.status(200).json(await executeRun()) }
  catch (error) { console.error('editorial_run_failed', error); return response.status(500).json({ status: 'failed', error: String(error.message || error) }) }
}

export { cleanText, rssItems, similarity, validateDraft, executeRun }
