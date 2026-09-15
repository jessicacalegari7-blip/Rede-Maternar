export default async function handler(request,response){
  response.setHeader('Cache-Control','public, max-age=86400, stale-while-revalidate=604800')
  const postal=String(request.query?.postal||'').replace(/\D/g,'')
  if(postal.length!==8)return response.status(400).json({error:'Informe um CEP com 8 números.'})
  try{
    const upstream=await fetch(`https://viacep.com.br/ws/${postal}/json/`,{headers:{accept:'application/json'},signal:AbortSignal.timeout(8000)})
    if(!upstream.ok)throw new Error('ViaCEP unavailable')
    const address=await upstream.json()
    if(address.erro)return response.status(404).json({error:'CEP não encontrado. Confira o número ou preencha o endereço manualmente.'})
    return response.status(200).json({postal_code:postal,address_line:String(address.logradouro||''),neighborhood:String(address.bairro||''),city:String(address.localidade||''),state_code:String(address.uf||'').toUpperCase()})
  }catch{
    return response.status(503).json({error:'Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente.'})
  }
}
