import test from 'node:test'
import assert from 'node:assert/strict'
import { clinicalAiStatus, disabledClinicalProvider } from '../api/_lib/clinical-ai-provider.mjs'

test('IA clínica permanece desligada mesmo com flag isolada', () => {
  const previous=process.env.AI_ASSISTANT
  process.env.AI_ASSISTANT='true'
  try {
    const status=clinicalAiStatus()
    assert.equal(status.AI_ASSISTANT.enabled,false)
    assert.equal(status.AI_TRANSCRIPTION.enabled,false)
    assert.equal(status.AI_DOCUMENT_RECOGNITION.enabled,false)
  } finally {
    if(previous===undefined)delete process.env.AI_ASSISTANT
    else process.env.AI_ASSISTANT=previous
  }
})

test('provedor desligado não processa dados', async () => {
  const provider=disabledClinicalProvider()
  await assert.rejects(provider.summarize('dados clínicos'),/não configurada/i)
  await assert.rejects(provider.transcribe('áudio'),/não configurada/i)
})
