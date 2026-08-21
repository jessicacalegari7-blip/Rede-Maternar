import { adminClient } from './_lib/supabase-admin.mjs'

const esc=value=>String(value).replace(/[<>&'"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]))
export default async function handler(_request,response){
  const {data,error}=await adminClient().from('published_clinic_directory').select('id,name,specialty_slug,state_code,city_slug,updated_at')
  if(error)return response.status(500).json({error:error.message})
  const groups=new Map(); for(const item of data||[])groups.set(`${item.specialty_slug}/${item.state_code.toLowerCase()}/${item.city_slug}`,item.updated_at)
  const directory=[...groups].map(([path,date])=>`<url><loc>${esc(`https://www.materplace.com.br/encontrar/${path}`)}</loc><lastmod>${date}</lastmod></url>`)
  const profiles=(data||[]).map(item=>{const slug=String(item.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return `<url><loc>${esc(`https://www.materplace.com.br/profissional/${slug}-${item.id}`)}</loc><lastmod>${item.updated_at}</lastmod></url>`})
  response.setHeader('Content-Type','application/xml; charset=utf-8');response.setHeader('Cache-Control','public, max-age=0, s-maxage=3600')
  return response.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${directory.join('')}${profiles.join('')}</urlset>`)
}
