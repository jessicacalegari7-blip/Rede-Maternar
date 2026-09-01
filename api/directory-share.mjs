import { adminClient } from './_lib/supabase-admin.mjs'

const ORIGIN='https://www.materplace.com.br'
const LOGO=`${ORIGIN}/brand/materplace-logo.png`
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const titleCase=value=>String(value||'').replace(/-/g,' ').replace(/\b\w/g,char=>char.toUpperCase())
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c')
const uuidFrom=value=>String(value||'').match(/([0-9a-f]{8}-[0-9a-f-]{27})$/i)?.[1]

function page({title,description,canonical,schema,content,index=true}){
  return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${index?'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1':'noindex, follow'}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="${LOGO}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${LOGO}"><script type="application/ld+json">${json(schema)}</script><style>body{margin:0;font:17px/1.6 system-ui;color:#173c32}header,main,footer{max-width:1040px;margin:auto;padding:24px}header img{max-width:220px;height:auto}article{border:1px solid #d8e2dd;border-radius:14px;padding:18px;margin:14px 0}h1{line-height:1.15}a{color:#0d6651}</style></head><body><header><a href="${ORIGIN}"><img src="${LOGO}" width="320" height="160" alt="MaterPlace"></a></header><main>${content}</main><footer><a href="${ORIGIN}/expediente">Expediente</a> · <a href="${ORIGIN}/privacidade">Privacidade</a> · <a href="${ORIGIN}/contato">Contato</a></footer></body></html>`
}

export default async function handler(request,response){
  try{
    const specialty=String(request.query.specialty||'')
    const state=String(request.query.uf||'').toUpperCase()
    const city=String(request.query.city||'')
    const profileId=uuidFrom(request.query.profile)
    const db=adminClient()
    response.setHeader('Content-Type','text/html; charset=utf-8')
    response.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=86400')
    if(profileId){
      const {data,error}=await db.from('published_clinic_directory').select('*').eq('id',profileId).maybeSingle()
      if(error)throw error
      if(!data)return response.status(404).send(page({title:'Perfil não encontrado | MaterPlace',description:'O perfil solicitado não está disponível.',canonical:`${ORIGIN}${request.url}`,schema:{'@context':'https://schema.org','@type':'WebPage'},content:'<h1>Perfil não encontrado</h1>',index:false}))
      const canonical=`${ORIGIN}/profissionais/${data.specialty_slug}/${String(data.state_code).toLowerCase()}/${data.city_slug}/${request.query.profile}`
      const description=`${data.name}, ${data.primary_specialty} em ${data.city}/${data.state_code}. Consulte as informações profissionais disponíveis na MaterPlace.`
      const schema={'@context':'https://schema.org','@type':/(pediatr|medic|ginecolog|obstetr|neurolog)/i.test(data.specialty_slug)?'Physician':'MedicalBusiness',name:data.name,medicalSpecialty:data.primary_specialty,url:canonical,address:{'@type':'PostalAddress',addressLocality:data.city,addressRegion:data.state_code,addressCountry:'BR',...(data.neighborhood?{addressNeighborhood:data.neighborhood}:{})}}
      return response.status(200).send(page({title:`${data.name} - ${data.primary_specialty} em ${data.city} | MaterPlace`,description,canonical,schema,content:`<article><h1>${escape(data.name)}</h1><h2>${escape(data.primary_specialty)}</h2><p>${escape([data.neighborhood,data.city,data.state_code].filter(Boolean).join(' · '))}</p><p>Confirme o registro no conselho profissional competente antes do atendimento.</p></article>`}))
    }
    const {data,error}=await db.from('published_clinic_directory').select('id,name,primary_specialty,specialty_slug,city,city_slug,state_code,neighborhood').eq('specialty_slug',specialty).eq('state_code',state).eq('city_slug',city).limit(100)
    if(error)throw error
    const specialtyName=titleCase(specialty),cityName=titleCase(city)
    const canonical=`${ORIGIN}/profissionais/${specialty}/${state.toLowerCase()}/${city}`
    const title=`${specialtyName} em ${cityName} - ${state} | Encontre Especialistas na MaterPlace`
    const description=`Procurando ${specialtyName} em ${cityName}? Encontre profissionais qualificados e conheça os perfis disponíveis na MaterPlace.`
    const schema={'@context':'https://schema.org','@type':'ItemList',name:`${specialtyName} em ${cityName}`,numberOfItems:data.length,itemListElement:data.map((item,index)=>({'@type':'ListItem',position:index+1,name:item.name,url:`${canonical}/${String(item.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${item.id}`}))}
    const cards=data.map(item=>`<article><h2>${escape(item.name)}</h2><p>${escape(item.primary_specialty)} · ${escape(item.city)}/${escape(item.state_code)}</p></article>`).join('')
    return response.status(200).send(page({title,description,canonical,schema,content:`<h1>${escape(specialtyName)} em ${escape(cityName)}, ${escape(state)}</h1>${cards||'<p>Novos profissionais estão em validação.</p>'}`,index:data.length>0}))
  }catch(error){return response.status(500).json({error:error instanceof Error?error.message:'Erro ao renderizar o diretório.'})}
}
