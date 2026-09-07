import { adminClient } from './_lib/supabase-admin.mjs'
import { MAX_URLS, SITE_URL, pageNumber, sendXml, urlNode, urlset } from './_lib/sitemap-xml.mjs'

const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
async function fetchWindow(buildQuery,offset,limit){const rows=[];for(let cursor=offset;cursor<offset+limit;cursor+=1000){const end=Math.min(cursor+999,offset+limit-1);const {data,error}=await buildQuery().range(cursor,end);if(error)throw error;rows.push(...(data||[]));if(!data||data.length<end-cursor+1)break}return rows}
export default async function handler(request,response) {
  try {
    const db=adminClient();const page=pageNumber(request)
    const profiles=await fetchWindow(()=>db.from('published_clinic_directory').select('id,name,specialty_slug,city_slug,state_code,updated_at').order('updated_at',{ascending:false}),(page-1)*MAX_URLS,MAX_URLS)
    const nodes=[];const seen=new Set()
    for(const item of profiles){const state=String(item.state_code||'').toLowerCase();const key=`${item.specialty_slug}/${state}/${item.city_slug}`;if(!item.specialty_slug||!state||!item.city_slug||seen.has(key))continue;seen.add(key);nodes.push(urlNode({loc:`${SITE_URL}/profissionais/${key}`,lastmod:item.updated_at,changefreq:'daily',priority:'0.9'}))}
    for(const item of profiles){const state=String(item.state_code||'').toLowerCase();if(state)nodes.push(urlNode({loc:`${SITE_URL}/profissionais/${item.specialty_slug}/${state}/${item.city_slug}/${slugify(item.name)}-${item.id}`,lastmod:item.updated_at,changefreq:'weekly',priority:'0.8'}))}
    return sendXml(response,urlset(nodes))
  } catch(error) { return response.status(500).json({error:error instanceof Error?error.message:'Erro ao gerar sitemap do diretório.'}) }
}
