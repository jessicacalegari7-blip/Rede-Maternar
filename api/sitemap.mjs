import { adminClient } from './_lib/supabase-admin.mjs'
import { MAX_URLS, SITE_URL, escapeXml, isoDate, sendXml } from './_lib/sitemap-xml.mjs'

const sitemapNode=(loc,lastmod)=>`<sitemap><loc>${escapeXml(loc)}</loc><lastmod>${isoDate(lastmod)}</lastmod></sitemap>`
const pageUrls=(name,count)=>{const pages=Math.max(1,Math.ceil(count/MAX_URLS));return pages===1?[`${SITE_URL}/sitemap-${name}.xml`]:Array.from({length:pages},(_,index)=>`${SITE_URL}/sitemap-${name}-${index+1}.xml`)}
export default async function handler(_request,response) {
  try {
    const db=adminClient()
    const [{count:posts},{count:targets},{count:profiles}]=await Promise.all([
      db.from('news_articles').select('id',{count:'exact',head:true}).eq('status','published'),
      db.from('professional_research_targets').select('id',{count:'exact',head:true}).eq('enabled',true),
      db.from('published_clinic_directory').select('id',{count:'exact',head:true}),
    ])
    const urls=[...pageUrls('posts',posts||0),...pageUrls('diretorio',(targets||0)+(profiles||0)),`${SITE_URL}/sitemap-categorias.xml`,`${SITE_URL}/sitemap-paginas.xml`]
    const xml=`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url=>sitemapNode(url,new Date())).join('')}</sitemapindex>`
    return sendXml(response,xml)
  } catch(error) { return response.status(500).json({error:error instanceof Error?error.message:'Erro ao gerar índice de sitemaps.'}) }
}
