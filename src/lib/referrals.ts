import { getUsers } from './auth'
export type ReferralStatus='invited'|'scheduled'|'paid'|'cancelled'
export interface Referral { id:string; referrerId:string; receiverId:string; patientName:string; patientEmail:string; service:string; amount:number; commissionRate:number; status:ReferralStatus; createdAt:string }
const KEY='rede-maternar:referrals'
const seed:Referral[]=[{id:'ref-1',referrerId:'professional-free',receiverId:'professional-1',patientName:'Mariana Costa',patientEmail:'mariana@exemplo.com',service:'Avaliação fonoaudiológica',amount:390,commissionRate:.2,status:'paid',createdAt:'2026-07-27T12:00:00.000Z'},{id:'ref-2',referrerId:'professional-1',receiverId:'professional-free',patientName:'Luiza Martins',patientEmail:'luiza@exemplo.com',service:'Acompanhamento com doula',amount:450,commissionRate:.2,status:'scheduled',createdAt:'2026-07-28T10:00:00.000Z'}]
function read(){if(typeof window==='undefined')return seed;const r=localStorage.getItem(KEY);if(!r){localStorage.setItem(KEY,JSON.stringify(seed));return seed}try{return JSON.parse(r) as Referral[]}catch{return seed}}
function write(v:Referral[]){if(typeof window!=='undefined')localStorage.setItem(KEY,JSON.stringify(v))}
export function getReferrals(){return read()}
export function createReferral(input:Omit<Referral,'id'|'commissionRate'|'status'|'createdAt'>){const v:Referral={...input,id:crypto.randomUUID(),commissionRate:.2,status:'invited',createdAt:new Date().toISOString()};write([v,...read()]);return v}
export function getReferralView(userId:string){const users=getUsers();return read().filter(r=>r.referrerId===userId||r.receiverId===userId).map(r=>({...r,referrer:users.find(u=>u.id===r.referrerId),receiver:users.find(u=>u.id===r.receiverId),commission:r.status==='paid'?r.amount*r.commissionRate:0}))}
