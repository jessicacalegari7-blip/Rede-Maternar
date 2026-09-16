import { clinicalAiStatus } from './_lib/clinical-ai-provider.mjs'
import { requireOrganization } from './_lib/supabase-admin.mjs'
import { allowMethods, json } from './_lib/http.mjs'

export default async function handler(request,response) {
  if(!allowMethods(request,response,['GET']))return
  try{
    await requireOrganization(request)
    json(response,200,{features:clinicalAiStatus(),provider:'disabled'})
  }catch(error){json(response,error.status||503,{error:error.status===401||error.status===403?error.message:'Configuração temporariamente indisponível.'})}
}
