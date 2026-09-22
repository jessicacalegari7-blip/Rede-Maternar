import { adminClient } from './_lib/supabase-admin.mjs'

const ARTICLE_LIST_FIELDS='id,slug,title,seo_title,excerpt,category,cover_image_url,author_name,status,featured,published_at,created_at,is_demo,views'
const ARTICLE_DETAIL_FIELDS=`${ARTICLE_LIST_FIELDS},content,updated_at`

function cachedImage(value){
  if(!value)return value
  try{const source=new URL(value),supabase=new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL);return source.hostname===supabase.hostname&&source.pathname.startsWith('/storage/v1/object/public/')?`/api/public-image?src=${encodeURIComponent(source.toString())}`:value}catch{return value}
}
const mapImages=row=>({...row,cover_image_url:cachedImage(row.cover_image_url),image_url:cachedImage(row.image_url)})

function send(response,status,body,cache='public, max-age=60, s-maxage=21600, stale-while-revalidate=604800, stale-if-error=604800') {
  response.setHeader('Content-Type','application/json; charset=utf-8')
  response.setHeader('Cache-Control',cache)
  return response.status(status).send(JSON.stringify(body))
}

export default async function handler(request,response) {
  if(request.method!=='GET')return send(response,405,{error:'Método não permitido.'},'no-store')
  try {
    const db=adminClient()
    const resource=String(request.query?.resource||'')
    if(resource==='articles'){
      const limit=Math.min(Math.max(Number(request.query?.limit)||100,1),100)
      const {data,error}=await db.from('news_articles').select(ARTICLE_LIST_FIELDS).eq('status','published').eq('is_demo',false).order('published_at',{ascending:false}).limit(limit)
      if(error)throw error
      return send(response,200,{data:(data||[]).map(mapImages)})
    }
    if(resource==='article'){
      const slug=String(request.query?.slug||'').replace(/[^a-z0-9-]/gi,'')
      if(!slug)return send(response,400,{error:'Slug inválido.'},'no-store')
      const {data,error}=await db.from('news_articles').select(ARTICLE_DETAIL_FIELDS).eq('slug',slug).eq('status','published').eq('is_demo',false).maybeSingle()
      if(error)throw error
      if(!data)return send(response,404,{error:'Matéria não encontrada.'},'public, max-age=60, s-maxage=300')
      return send(response,200,{data:mapImages(data)})
    }
    if(resource==='videos'){
      const {data,error}=await db.from('portal_videos').select('id,title,description,youtube_id,published,featured,created_at').eq('published',true).order('featured',{ascending:false}).order('created_at',{ascending:false}).limit(12)
      if(error)throw error
      return send(response,200,{data:data||[]})
    }
    if(resource==='specialties'){
      const {data,error}=await db.from('specialties').select('name').eq('active',true).order('name').limit(300)
      if(error)throw error
      return send(response,200,{data:data||[]},'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800')
    }
    if(resource==='ecosystem'){
      const tables={marketplace:'marketplace_items',courses:'courses',jobs:'jobs'}
      const table=tables[String(request.query?.kind||'')]
      if(!table)return send(response,400,{error:'Tipo inválido.'},'no-store')
      const slug=String(request.query?.slug||'').replace(/[^a-z0-9-]/gi,'')
      let query=db.from(table).select('*').eq('status','published').eq('demo',false)
      if(slug)query=query.eq('slug',slug).limit(1)
      else query=query.order('featured',{ascending:false}).order('published_at',{ascending:false}).limit(60)
      const {data,error}=await query
      if(error)throw error
      return send(response,200,{data:slug?(data?.[0]?mapImages(data[0]):null):(data||[]).map(mapImages)})
    }
    return send(response,400,{error:'Recurso inválido.'},'no-store')
  } catch(error) {
    return send(response,503,{error:'Conteúdo temporariamente indisponível.'},'no-store')
  }
}
