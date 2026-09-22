import sharp from 'sharp'

export default async function handler(request,response){
  if(request.method!=='GET')return response.status(405).send('Método não permitido.')
  try{
    const source=new URL(String(request.query?.src||''))
    const supabase=new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL)
    if(source.hostname!==supabase.hostname||!source.pathname.startsWith('/storage/v1/object/public/'))return response.status(400).send('Imagem inválida.')
    const upstream=await fetch(source,{signal:AbortSignal.timeout(10000)})
    if(!upstream.ok)return response.status(upstream.status).send('Imagem indisponível.')
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
