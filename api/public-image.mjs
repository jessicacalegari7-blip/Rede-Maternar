import sharp from 'sharp'

const placeholder=response=>{
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#f6f1e8"/><path d="M0 540L300 310l190 155 175-128 535 338H0z" fill="#dfe9e3"/><circle cx="930" cy="170" r="70" fill="#d4af37" opacity=".8"/><text x="600" y="610" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" fill="#0d2b23">MaterPlace · imagem temporariamente indisponível</text></svg>'
  response.setHeader('Content-Type','image/svg+xml; charset=utf-8')
  response.setHeader('Cache-Control','public, max-age=300, s-maxage=300, stale-while-revalidate=3600')
  response.setHeader('X-MaterPlace-Image-Source','local-placeholder')
  return response.status(200).send(svg)
}

export default async function handler(request,response){
  if(request.method!=='GET')return response.status(405).send('Método não permitido.')
  try{
    const source=new URL(String(request.query?.src||''))
    const supabase=new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL)
    if(source.hostname!==supabase.hostname||!source.pathname.startsWith('/storage/v1/object/public/'))return response.status(400).send('Imagem inválida.')
    let upstream
    try{upstream=await fetch(source,{signal:AbortSignal.timeout(10000)})}catch{return placeholder(response)}
    if(!upstream.ok){
      if([402,429].includes(upstream.status)||upstream.status>=500)return placeholder(response)
      return response.status(upstream.status).send('Imagem indisponível.')
    }
    const declared=Number(upstream.headers.get('content-length')||0)
    if(declared>15*1024*1024)return response.status(413).send('Imagem muito grande.')
    const input=Buffer.from(await upstream.arrayBuffer())
    if(input.length>15*1024*1024)return response.status(413).send('Imagem muito grande.')
    const width=Math.min(Math.max(Number(request.query?.w)||1200,160),1600)
    const output=await sharp(input).rotate().resize({width,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer()
    response.setHeader('Content-Type','image/webp')
    response.setHeader('Cache-Control','public, max-age=2592000, s-maxage=31536000, immutable')
    return response.status(200).send(output)
  }catch{return response.status(400).send('Imagem inválida.')}
}
