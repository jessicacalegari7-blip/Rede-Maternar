import { adminClient } from './_lib/supabase-admin.mjs'

const ORIGIN='https://www.materplace.com.br'

export default async function handler(request,response){
  if(request.method!=='GET')return response.status(405).json({error:'Método não permitido.'})
  const identifier=String(request.query.profile||'').trim().toLowerCase()
  if(!identifier)return response.status(404).send('Perfil não encontrado.')
  try{
    const db=adminClient()
    const field=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identifier)?'id':'public_slug'
    const {data,error}=await db.from('marketplace_professionals').select('public_slug').eq(field,identifier).maybeSingle()
    if(error)throw error
    if(!data?.public_slug)return response.status(404).send('Perfil não encontrado ou não publicado.')
    response.setHeader('Cache-Control','public, max-age=300, s-maxage=3600')
    return response.redirect(301,`${ORIGIN}/${data.public_slug}`)
  }catch(error){
    console.error('public_profile_redirect_failed',{code:error?.code||'unknown'})
    return response.status(500).send('Não foi possível localizar o perfil.')
  }
}
