import fs from 'node:fs'

const raw=fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):''
const local=Object.fromEntries(raw.split(/\r?\n/).map(line=>line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(match=>[match[1],match[2].replace(/^['"]|['"]$/g,'')]))
const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||local.SUPABASE_URL||local.VITE_SUPABASE_URL
const key=process.env.VITE_SUPABASE_ANON_KEY||local.VITE_SUPABASE_ANON_KEY
if(!base||!key){console.log('Supabase: configuração local ausente.');process.exit(1)}

const resources=['news_articles','published_clinic_directory','specialties','professional_profiles']
for(const resource of resources){
  try{
    const response=await fetch(`${base}/rest/v1/${resource}?select=id&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`,Prefer:'count=exact'}})
    const text=await response.text();let code='none'
    try{code=JSON.parse(text).code||'none'}catch{/* não imprime a resposta para evitar dados */}
    console.log(`${resource}: HTTP ${response.status}; count ${response.headers.get('content-range')||'indisponível'}; code ${code}`)
  }catch{console.log(`${resource}: falha de rede`)}
}
