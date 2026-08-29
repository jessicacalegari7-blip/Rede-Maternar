import { useEffect } from 'react'

const ORIGIN = 'https://materplace.com.br'
const DEFAULT_IMAGE = `${ORIGIN}/brand/materplace-logo.png`

type SeoProps = { title:string; description:string; path?:string; image?:string|null; type?:'website'|'article'; schema?:Record<string,unknown>|Array<Record<string,unknown>>; appendBrand?:boolean }

function meta(selector:string, attributes:Record<string,string>) { let element=document.head.querySelector<HTMLMetaElement>(selector); if(!element){element=document.createElement('meta');document.head.appendChild(element)} Object.entries(attributes).forEach(([key,value])=>element!.setAttribute(key,value)) }

export function Seo({title,description,path=window.location.pathname,image,type='website',schema,appendBrand=true}:SeoProps){
  useEffect(()=>{
    const canonical=new URL(path,ORIGIN).toString(); const shareImage=image?new URL(image,ORIGIN).toString():DEFAULT_IMAGE
    document.title=appendBrand?`${title} | MaterPlace`:title
    meta('meta[name="description"]',{name:'description',content:description}); meta('meta[name="robots"]',{name:'robots',content:'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'})
    ;[['og:title',title],['og:description',description],['og:image',shareImage],['og:url',canonical],['og:type',type],['og:locale','pt_BR'],['og:site_name','MaterPlace']].forEach(([property,content])=>meta(`meta[property="${property}"]`,{property,content}))
    ;[['twitter:card','summary_large_image'],['twitter:title',title],['twitter:description',description],['twitter:image',shareImage]].forEach(([name,content])=>meta(`meta[name="${name}"]`,{name,content}))
    let link=document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]'); if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)} link.href=canonical
    document.querySelectorAll('script[data-materplace-schema]').forEach(node=>node.remove()); if(schema){const script=document.createElement('script');script.type='application/ld+json';script.dataset.materplaceSchema='true';script.text=JSON.stringify(schema);document.head.appendChild(script)}
  },[title,description,path,image,type,schema,appendBrand]); return null
}

export const baseSchemas=[
  {'@context':'https://schema.org','@type':'Organization',name:'MaterPlace',url:ORIGIN,logo:DEFAULT_IMAGE,description:'Ecossistema materno-infantil que conecta famílias, profissionais e clínicas.'},
  {'@context':'https://schema.org','@type':'WebSite',name:'MaterPlace',url:ORIGIN,description:'Portal de notícias e marketplace de profissionais materno-infantis',potentialAction:{'@type':'SearchAction',target:`${ORIGIN}/profissionais?busca={search_term_string}`,'query-input':'required name=search_term_string'}},
]
