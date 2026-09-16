// Nenhum provedor externo é acionado nesta fase. Dados clínicos jamais saem do servidor por padrão.
const features=['AI_ASSISTANT','AI_TRANSCRIPTION','AI_DOCUMENT_RECOGNITION','AI_CONSULTATION_ANALYSIS','AI_EMBEDDINGS']

export function clinicalAiStatus() {
  return Object.fromEntries(features.map(feature=>[feature,{
    enabled:false,
    configured:false,
    reason:process.env[feature]==='true'?'A integração clínica ainda não foi ativada com segurança.':'Requer configuração.',
  }]))
}

export function disabledClinicalProvider() {
  const unavailable=async()=>{throw new Error('Inteligência artificial clínica não configurada.')}
  return Object.freeze({
    name:'disabled',
    generateText:unavailable,
    summarize:unavailable,
    extractStructuredData:unavailable,
    analyzeDocument:unavailable,
    transcribe:unavailable,
    generateEmbedding:unavailable,
  })
}
