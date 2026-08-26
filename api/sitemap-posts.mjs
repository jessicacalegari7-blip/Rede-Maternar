import { adminClient } from './_lib/supabase-admin.mjs'
import { SITE_URL, fetchRange, pageNumber, sendXml, urlNode, urlset } from './_lib/sitemap-xml.mjs'

export default async function handler(request,response) {
  try {
    const db=adminClient(); const page=pageNumber(request)
    const rows=await fetchRange(()=>db.from('news_articles').select('slug,published_at,updated_at').eq('status','published').order('published_at',{ascending:false}),page)
    const now=Date.now(); const nodes=rows.map(item=>{const published=new Date(item.published_at||item.updated_at).getTime();const recent=now-published<7*86400000;return urlNode({loc:`${SITE_URL}/noticias/${item.slug}`,lastmod:item.updated_at||item.published_at,changefreq:recent?'daily':'weekly',priority:recent?'0.9':'0.7'})})
    return sendXml(response,urlset(nodes))
  } catch(error) { return response.status(500).json({error:error instanceof Error?error.message:'Erro ao gerar sitemap de posts.'}) }
}
