import { getUsers } from './auth'
export type ReferralStatus='sent'|'viewed'|'accepted'|'scheduled'|'converted'|'paid'|'cancelled'|'refused'
export interface Referral { id:string; referrerId:string; receiverId:string; patientName:string; patientEmail:string; service:string; amount:number; commissionRate:number; status:ReferralStatus; createdAt:string }
const KEY='rede-maternar:referrals'
const seed:Referral[]=[{id:'ref-1',referrerId:'professional-free',receiverId:'professional-1',patientName:'Mariana Costa',patientEmail:'mariana@exemplo.com',service:'Avaliação fonoaudiológica',amount:390,commissionRate:.15,status:'paid',createdAt:'2026-07-27T12:00:00.000Z'}]
function read(){if(typeof window==='undefined')return seed;const raw=localStorage.getItem(KEY);if(!raw){localStorage.setItem(KEY,JSON.stringify(seed));return seed}try{return JSON.parse(raw) as Referral[]}catch{return seed}}
function write(value:Referral[]){if(typeof window!=='undefined')localStorage.setItem(KEY,JSON.stringify(value))}
export function getReferrals(){return read()}
export function createReferral(input:Omit<Referral,'id'|'commissionRate'|'status'|'createdAt'>){
  const receiver=getUsers().find(user=>user.id===input.receiverId)
  if(receiver?.role!=='professional'||receiver.plan!=='annual')throw new Error('Somente profissionais do Plano Anual podem receber indicações.')
  const value:Referral={...input,id:crypto.randomUUID(),commissionRate:.15,status:'sent',createdAt:new Date().toISOString()}
  write([value,...read()]);return value
}
export function getReferralView(userId:string){const users=getUsers();return read().filter(value=>value.referrerId===userId||value.receiverId===userId).map(value=>({...value,referrer:users.find(user=>user.id===value.referrerId),receiver:users.find(user=>user.id===value.receiverId),commission:value.status==='paid'?value.amount*value.commissionRate:0}))}
