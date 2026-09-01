import { adminClient } from './supabase-admin.mjs'
import { MAX_URLS, SITE_URL, fetchRange, pageNumber, sendXml, urlNode, urlset } from './sitemap-xml.mjs'

const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
const pages=['','profissionais','para-profissionais','sobre','expediente','contato','privacidade','termos','lgpd','cookies','isencao-de-responsabilidade']

async function fetchWindow(buildQuery,offset,limit){const rows=[];for(let cursor=offset;cursor<offset+limit;cursor+=1000){const end=Math.min(cursor+999,offset+limit-1);const {data,error}=await buildQuery().range(cursor,end);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<end-cursor+1)break}return rows}

export async function posts(request,response){
  const db=adminClient(); const page=pageNumber(request)
  const rows=await fetchRange(()=>db.from('news_articles').select('slug,published_at,updated_at').eq('status','published').order('published_at',{ascending:false}),page)
  const now=Date.now(); const nodes=rows.map(item=>{const published=new Date(item.published_at||item.updated_at).getTime();const recent=now-published<7*86400000;return urlNode({loc:`${SITE_URL}/noticias/${item.slug}`,lastmod:item.updated_at||item.published_at,changefreq:recent?'daily':'weekly',priority:recent?'0.9':'0.7'})})
  return sendXml(response,urlset(nodes))
}

export async function directory(request,response){
  const db=adminClient();const page=pageNumber(request)
  const profiles=await fetchRange(()=>db.from('published_clinic_directory').select('*').order('id',{ascending:true}),page)
  const nodes=[];const seen=new Set()
  for(const item of profiles){const specialty=item.specialty_slug||slugify(item.primary_specialty);const city=item.city_slug||slugify(item.city);const state=String(item.state_code||'').toLowerCase();const key=`${specialty}/${state}/${city}`;if(!specialty||!state||!city||seen.has(key))continue;seen.add(key);nodes.push(urlNode({loc:`${SITE_URL}/profissionais/${key}`,lastmod:item.updated_at||item.created_at,changefreq:'daily',priority:'0.9'}))}
  for(const item of profiles){const specialty=item.specialty_slug||slugify(item.primary_specialty);const city=item.city_slug||slugify(item.city);const state=String(item.state_code||'').toLowerCase();if(specialty&&state&&city)nodes.push(urlNode({loc:`${SITE_URL}/profissionais/${specialty}/${state}/${city}/${slugify(item.name)}-${item.id}`,lastmod:item.updated_at,changefreq:'weekly',priority:'0.8'}))}
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
