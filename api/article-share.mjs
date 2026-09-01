const ORIGIN='https://www.materplace.com.br'
const LOGO=`${ORIGIN}/brand/materplace-logo.png`
const esc=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c')
const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
const paragraphs=value=>String(value||'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').split(/\n\s*\n/).filter(Boolean).map(block=>{
  const text=plain(block.replace(/^#{2,3}\s+/,'').replace(/^[-*>]\s+/gm,''))
  if(!text)return''
  if(/^#{2,3}\s+/.test(block))return`<h2>${esc(text)}</h2>`
  return`<p>${esc(text)}</p>`
}).join('')

export default async function handler(req,res){
  const slug=String(req.query?.slug||'').replace(/[^a-z0-9-]/gi,'')
  if(!slug)return res.status(400).send('Slug inválido')
  const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.VITE_SUPABASE_ANON_KEY
  if(!base||!key)return res.redirect(302,`/noticias/${slug}`)
  const fields='title,seo_title,excerpt,content,category,cover_image_url,author_name,published_at,created_at,updated_at'
  const response=await fetch(`${base}/rest/v1/news_articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=${fields}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}})
  const [article]=response.ok?await response.json():[]
  if(!article){res.setHeader('X-Robots-Tag','noindex, follow');return res.status(404).send('Notícia não encontrada')}
  const url=`${ORIGIN}/noticias/${slug}`
  const image=article.cover_image_url||LOGO
  const title=article.seo_title||article.title
  const published=article.published_at||article.created_at
  const modified=article.updated_at||published
  const schemas=[
    {'@context':'https://schema.org','@type':'NewsArticle',headline:article.title,description:article.excerpt,image:[image],datePublished:published,dateModified:modified,author:{'@type':'Person',name:article.author_name||'Equipe MaterPlace'},publisher:{'@type':'Organization',name:'MaterPlace',url:ORIGIN,logo:{'@type':'ImageObject',url:LOGO}},mainEntityOfPage:{'@type':'WebPage','@id':url}},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Início',item:`${ORIGIN}/`},{'@type':'ListItem',position:2,name:article.category||'Notícias',item:`${ORIGIN}/categoria/${encodeURIComponent(String(article.category||'noticias').toLowerCase())}`},{'@type':'ListItem',position:3,name:article.title,item:url}]},
  ]
  res.setHeader('Content-Type','text/html; charset=utf-8')
  res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=3600')
  return res.status(200).send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(article.excerpt)}"><meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"><link rel="canonical" href="${url}"><meta property="og:type" content="article"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="MaterPlace"><meta property="og:title" content="${esc(article.title)}"><meta property="og:description" content="${esc(article.excerpt)}"><meta property="og:image" content="${esc(image)}"><meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(article.title)}"><meta name="twitter:description" content="${esc(article.excerpt)}"><meta name="twitter:image" content="${esc(image)}"><script type="application/ld+json">${json(schemas)}</script><style>body{margin:0;font:18px/1.7 system-ui;color:#173c32}header,main,footer{max-width:900px;margin:auto;padding:24px}img{max-width:100%;height:auto}h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.12}small{color:#526d65}.notice{border-left:4px solid #c5a23c;padding:12px 16px;background:#faf7ef}a{color:#0d6651}</style></head><body><header><a href="${ORIGIN}/"><img src="${LOGO}" width="220" height="110" alt="MaterPlace"></a></header><main><article><nav aria-label="Navegação estrutural"><a href="${ORIGIN}/">Início</a> › ${esc(article.category||'Notícias')}</nav><h1>${esc(article.title)}</h1><p><strong>${esc(article.excerpt)}</strong></p><small>Publicado em ${esc(new Date(published).toLocaleDateString('pt-BR'))} · ${esc(article.author_name||'Equipe MaterPlace')}</small>${article.cover_image_url?`<img src="${esc(image)}" width="1600" height="900" alt="Imagem de capa: ${esc(article.title)}">`:''}<section>${paragraphs(article.content)}</section><aside class="notice"><strong>Informação de saúde com finalidade educativa.</strong> Este conteúdo não substitui diagnóstico, prescrição ou atendimento individual. Em caso de sintomas ou emergência, procure um serviço de saúde.</aside></article></main><footer><a href="${ORIGIN}/expediente">Expediente</a> · <a href="${ORIGIN}/sobre">Sobre</a> · <a href="${ORIGIN}/isencao-de-responsabilidade">Isenção</a> · <a href="${ORIGIN}/contato">Contato</a></footer></body></html>`)
}
