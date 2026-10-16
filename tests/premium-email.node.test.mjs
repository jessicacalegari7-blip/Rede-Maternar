import test from 'node:test'
import assert from 'node:assert/strict'
import {deliverPremiumActivationEmail} from '../api/_lib/premium-email.mjs'

const originalFetch=global.fetch
const originalKey=process.env.BREVO_API_KEY

function database(claim={should_send:true,status:'processing',notification_id:'notification-1'}){
  const calls=[]
  return {calls,auth:{admin:{getUserById:async()=>({data:{user:{email:'teste@example.com',email_confirmed_at:null,user_metadata:{full_name:'Teste'}}}}),generateLink:async()=>({data:{properties:{action_link:'https://example.com/confirm'}}})}},rpc:async(name,args)=>{calls.push([name,args]);if(name==='claim_premium_activation_email')return {data:claim};return {data:null}}}
}

test.after(()=>{global.fetch=originalFetch;if(originalKey===undefined)delete process.env.BREVO_API_KEY;else process.env.BREVO_API_KEY=originalKey})

test('envia pelo Brevo e só registra sent após confirmação HTTP',async()=>{
  process.env.BREVO_API_KEY='test-key'
  global.fetch=async(_url,options)=>{assert.equal(options.headers['api-key'],'test-key');return {ok:true,json:async()=>({messageId:'brevo-1'})}}
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
