import { adminClient } from './_lib/supabase-admin.mjs'
const escapeXml=value=>String(value||'').replace(/[<>&'\"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]))
export default async function handler(_request,response){
  const since=new Date(Date.now()-48*60*60*1000).toISOString()
  const {data,error}=await adminClient().from('news_articles').select('slug,title,published_at').eq('status','published').gte('published_at',since).order('published_at',{ascending:false})
  if(error)return response.status(500).send('Erro ao gerar sitemap')
  const urls=(data||[]).map(item=>`<url><loc>https://materplace.com.br/noticias/${escapeXml(item.slug)}</loc><news:news><news:publication><news:name>MaterPlace</news:name><news:language>pt-BR</news:language></news:publication><news:publication_date>${escapeXml(item.published_at)}</news:publication_date><news:title>${escapeXml(item.title)}</news:title></news:news></url>`).join('')
  response.setHeader('Content-Type','application/xml; charset=utf-8');response.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600');return response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}</urlset>`)
}
