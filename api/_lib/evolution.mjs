function required(name) {
  const value=process.env[name]?.trim()
  if(!value) throw Object.assign(new Error(`Variável obrigatória ausente: ${name}`),{status:503})
  return value
}

export async function evolution(path,{method='GET',body}={}) {
  const base=required('EVOLUTION_API_URL').replace(/\/$/,'')
  const response=await fetch(`${base}${path}`,{
    method,headers:{apikey:required('EVOLUTION_API_KEY'),'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),
  })
  const text=await response.text(); let data={}
  try{data=text?JSON.parse(text):{}}catch{data={message:text}}
  if(!response.ok) throw Object.assign(new Error(data?.message||data?.error||`Evolution API respondeu ${response.status}`),{status:502,details:data})
  return data
}

export function normalizePhone(value=''){return String(value).replace(/\D/g,'')}
