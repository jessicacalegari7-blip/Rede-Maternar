import { adminClient } from './supabase-admin.mjs'
import { MAX_URLS, SITE_URL, fetchRange, pageNumber, sendXml, urlNode, urlset } from './sitemap-xml.mjs'

const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const pages=['','profissionais','para-profissionais','sobre','contato','privacidade','termos','lgpd','cookies','isencao-de-responsabilidade']

async function fetchWindow(buildQuery,offset,limit){const rows=[];for(let cursor=offset;cursor<offset+limit;cursor+=1000){const end=Math.min(cursor+999,offset+limit-1);const {data,error}=await buildQuery().range(cursor,end);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<end-cursor+1)break}return rows}

export async function posts(request,response){
  const db=adminClient(); const page=pageNumber(request)
  const rows=await fetchRange(()=>db.from('news_articles').select('slug,published_at,updated_at').eq('status','published').order('published_at',{ascending:false}),page)
  const now=Date.now(); const nodes=rows.map(item=>{const published=new Date(item.published_at||item.updated_at).getTime();const recent=now-published<7*86400000;return urlNode({loc:`${SITE_URL}/noticias/${item.slug}`,lastmod:item.updated_at||item.published_at,changefreq:recent?'daily':'weekly',priority:recent?'0.9':'0.7'})})
  return sendXml(response,urlset(nodes))
}

export async function directory(request,response){
  const db=adminClient();const page=pageNumber(request)
  const {count:targetCount,error:countError}=await db.from('professional_research_targets').select('id',{count:'exact',head:true}).eq('enabled',true)
  if(countError)throw countError
  const globalOffset=(page-1)*MAX_URLS;const targetsAvailable=Math.max(0,availableTargets-globalOffset);const targetLimit=Math.min(MAX_URLS,targetsAvailable)
  const targets=targetLimit?await fetchWindow(()=>db.from('professional_research_targets').select('specialty_slug,city_slug,last_run_at,created_at').eq('enabled',true).order('priority'),globalOffset,targetLimit):[]
  const profileLimit=MAX_URLS-targets.length;const profileOffset=Math.max(0,globalOffset-availableTargets)
  const profiles=profileLimit?await fetchWindow(()=>db.from('published_clinic_directory').select('id,name,specialty_slug,city_slug,updated_at').order('updated_at',{ascending:false}),profileOffset,profileLimit):[]
  const nodes=[];const seen=new Set()
  for(const item of [...targets,...profiles]){const key=`${item.specialty_slug}/${item.city_slug}`;if(!item.specialty_slug||!item.city_slug||seen.has(key))continue;seen.add(key);nodes.push(urlNode({loc:`${SITE_URL}/profissionais/${key}`,lastmod:item.updated_at||item.last_run_at||item.created_at,changefreq:'daily',priority:'0.9'}))}
  for(const item of profiles)nodes.push(urlNode({loc:`${SITE_URL}/profissional/${slugify(item.name)}-${item.id}`,lastmod:item.updated_at,changefreq:'weekly',priority:'0.8'}))
  return sendXml(response,urlset(nodes))
}

export async function categories(_request,response){
  const {data,error}=await adminClient().from('news_articles').select('category,updated_at').eq('status','published').order('updated_at',{ascending:false})
  if(error)throw error
  const values=new Map();for(const item of data||[]){const slug=slugify(item.category);if(slug&&!values.has(slug))values.set(slug,item.updated_at)}
  return sendXml(response,urlset([...values].map(([slug,lastmod])=>urlNode({loc:`${SITE_URL}/categoria/${slug}`,lastmod,changefreq:'daily',priority:'0.8'}))))
}

export function staticPages(_request,response){
  const lastmod=new Date().toISOString()
  return sendXml(response,urlset(pages.map(path=>urlNode({loc:`${SITE_URL}/${path}`,lastmod,changefreq:'monthly',priority:path===''?'1.0':'0.3'}))),3600)
}
