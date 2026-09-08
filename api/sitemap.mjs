import { adminClient } from './_lib/supabase-admin.mjs'
import { MAX_URLS, SITE_URL, escapeXml, isoDate, sendXml } from './_lib/sitemap-xml.mjs'
import { categories, directory, posts, staticPages } from './_lib/sitemap-handlers.mjs'

const sitemapNode=(loc,lastmod)=>`<sitemap><loc>${escapeXml(loc)}</loc><lastmod>${isoDate(lastmod)}</lastmod></sitemap>`
const pageUrls=(name,count)=>{const pages=Math.max(1,Math.ceil(count/MAX_URLS));return pages===1?[`${SITE_URL}/sitemap-${name}.xml`]:Array.from({length:pages},(_,index)=>`${SITE_URL}/sitemap-${name}-${index+1}.xml`)}
const countOrZero=async query=>{const {count,error}=await query;return error?0:(count||0)}
const news=async response=>{
  const since=new Date(Date.now()-48*60*60*1000).toISOString()
  const {data,error}=await adminClient().from('news_articles').select('slug,title,published_at').eq('status','published').gte('published_at',since).order('published_at',{ascending:false})
  if(error)throw error
  const urls=(data||[]).map(item=>`<url><loc>${SITE_URL}/noticias/${escapeXml(item.slug)}</loc><news:news><news:publication><news:name>MaterPlace</news:name><news:language>pt-BR</news:language></news:publication><news:publication_date>${escapeXml(item.published_at)}</news:publication_date><news:title>${escapeXml(item.title)}</news:title></news:news></url>`).join('')
  response.setHeader('Content-Type','application/xml; charset=utf-8')
  response.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=3600')
  return response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}</urlset>`)
}
export default async function handler(request,response) {
  try {
    const type=String(request.query?.type||'index')
    if(type==='posts')return await posts(request,response)
    if(type==='directory')return await directory(request,response)
    if(type==='categories')return await categories(request,response)
    if(type==='pages')return staticPages(request,response)
    if(type==='news')return await news(response)
    const db=adminClient()
    const [postCount,profileCount]=await Promise.all([
      countOrZero(db.from('news_articles').select('id',{count:'exact',head:true}).eq('status','published')),
      countOrZero(db.from('published_clinic_directory').select('id',{count:'exact',head:true})),
    ])
    const urls=[...pageUrls('posts',postCount||0),...pageUrls('diretorio',profileCount||0),`${SITE_URL}/sitemap-categorias.xml`,`${SITE_URL}/sitemap-paginas.xml`]
    const xml=`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>sitemapNode(url,new Date())).join('')}</sitemapindex>`
    return sendXml(response,xml)
  } catch(error) { return response.status(500).json({error:error?.message||'Erro ao gerar sitemap.'}) }
}
