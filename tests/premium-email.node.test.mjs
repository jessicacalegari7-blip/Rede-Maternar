import test from 'node:test'
import assert from 'node:assert/strict'
import {createPremiumInviteToken,deliverPremiumAccessInvite,deliverPremiumActivationEmail,hashPremiumInviteToken} from '../api/_lib/premium-email.mjs'

const originalFetch=global.fetch
const originalKey=process.env.BREVO_API_KEY

function database(claim={should_send:true,status:'processing',notification_id:'notification-1'}){
  const calls=[]
  return {calls,auth:{admin:{getUserById:async()=>({data:{user:{email:'teste@example.com',email_confirmed_at:null,user_metadata:{full_name:'Teste'}}}}),generateLink:async()=>({data:{properties:{action_link:'https://example.com/confirm'}}})}},rpc:async(name,args)=>{calls.push([name,args]);if(name==='claim_premium_activation_email')return {data:claim};return {data:null}}}
}

test.after(()=>{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.BREVO_API_KEY;else process.env.BREVO_API_KEY=originalKey})

test('envia pelo Brevo e só registra sent após confirmação HTTP',async()=>{
  process.env.BREVO_API_KEY='test-key'
  global.fetch=async(_url,options)=>{assert.equal(options.headers['api-key'],'test-key');const payload=JSON.parse(options.body);assert.match(payload.htmlContent,/WhatsApp do suporte/);assert.match(payload.textContent,/\(11\) 93007-8750/);assert.match(payload.textContent,/wa\.me\/5511930078750/);return {ok:true,json:async()=>({messageId:'brevo-1'})}}
  const db=database(),status=await deliverPremiumActivationEmail(db,{userId:'user-1',orderId:'order-1'})
  assert.equal(status,'sent')
  assert.equal(db.calls.at(-1)[0],'finish_premium_activation_email')
  assert.equal(db.calls.at(-1)[1].target_status,'sent')
})

test('webhook repetido não duplica e-mail já enviado',async()=>{
  process.env.BREVO_API_KEY='test-key';let requests=0;global.fetch=async()=>{requests++;return {ok:true,json:async()=>({})}}
  const status=await deliverPremiumActivationEmail(database({should_send:false,status:'sent',notification_id:'notification-1'}),{userId:'user-1',orderId:'order-1'})
  assert.equal(status,'already_sent');assert.equal(requests,0)
})

test('falha temporária faz três tentativas e permanece na fila',async()=>{
  process.env.BREVO_API_KEY='test-key';let requests=0;global.fetch=async()=>{requests++;return {ok:false,status:503,json:async()=>({})}}
  const db=database(),status=await deliverPremiumActivationEmail(db,{userId:'user-1',orderId:'order-1'})
  assert.equal(status,'failed');assert.equal(requests,3);assert.equal(db.calls.at(-1)[1].target_status,'failed')
})

test('convite usa token aleatório forte e armazena apenas hash estável',()=>{
  const first=createPremiumInviteToken(),second=createPremiumInviteToken()
  assert.ok(first.length>=43)
  assert.notEqual(first,second)
  assert.match(hashPremiumInviteToken(first),/^[0-9a-f]{64}$/)
  assert.equal(hashPremiumInviteToken(first),hashPremiumInviteToken(first))
})

test('convite transacional inclui assunto, HTML leve e versão em texto simples',async()=>{
  process.env.BREVO_API_KEY='test-key'
  let payload
  global.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({messageId:'brevo-invite-1'})}}
  const calls=[],db={rpc:async(name,args)=>{calls.push([name,args]);if(name==='issue_premium_access_invite')return {data:{should_send:true,status:'processing',invite_id:'invite-1',email:'teste@example.com',name:'Profissional Teste'}};return {data:null}}}
  const status=await deliverPremiumAccessInvite(db,{orderId:'order-1'})
  assert.equal(status,'sent')
  assert.equal(payload.sender.email,'diretorio@materplace.com.br')
  assert.equal(payload.subject,'MaterPlace | Pagamento confirmado — Crie sua senha')
  assert.match(payload.htmlContent,/Pagamento confirmado!/)
  assert.match(payload.htmlContent,/CRIAR MINHA SENHA/)
  assert.match(payload.htmlContent,/WhatsApp do suporte/)
  assert.match(payload.htmlContent,/wa\.me\/5511930078750/)
  assert.match(payload.textContent,/Crie sua senha de acesso/)
  assert.match(payload.textContent,/\(11\) 93007-8750/)
  assert.match(payload.textContent,/Ol%C3%A1%21%20Preciso%20de%20ajuda/)
  assert.equal(calls.at(-1)[1].target_provider_id,'brevo-invite-1')
})
