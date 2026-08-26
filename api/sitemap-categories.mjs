import { adminClient } from './_lib/supabase-admin.mjs'
import { SITE_URL, sendXml, urlNode, urlset } from './_lib/sitemap-xml.mjs'

const slugify=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
export default async function handler(_request,response) {
  try {
    const {data,error}=await adminClient().from('news_articles').select('category,updated_at').eq('status','published').order('updated_at',{ascending:false})
    if(error)throw error
    const categories=new Map();for(const item of data||[]){const slug=slugify(item.category);if(slug&&!categories.has(slug))categories.set(slug,item.updated_at)}
    return sendXml(response,urlset([...categories].map(([slug,lastmod])=>urlNode({loc:`${SITE_URL}/categoria/${slug}`,lastmod,changefreq:'daily',priority:'0.8'}))))
  } catch(error) { return response.status(500).json({error:error instanceof Error?error.message:'Erro ao gerar sitemap de categorias.'}) }
}
