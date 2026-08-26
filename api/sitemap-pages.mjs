import { SITE_URL, sendXml, urlNode, urlset } from './_lib/sitemap-xml.mjs'

const pages=['','profissionais','para-profissionais','sobre','contato','privacidade','termos','lgpd','cookies','isencao-de-responsabilidade']
export default function handler(_request,response) {
  const lastmod=new Date().toISOString()
  return sendXml(response,urlset(pages.map(path=>urlNode({loc:`${SITE_URL}/${path}`,lastmod,changefreq:'monthly',priority:path===''?'1.0':'0.3'}))),3600)
}
