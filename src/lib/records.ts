import { getUsers } from './auth'
export interface RecordConsent { patientId:string; globalConsent:boolean; professionalIds:string[]; updatedAt:string }
export interface RecordEntry { id:string; patientId:string; professionalId:string; type:'evolution'|'report'|'file'; title:string; content:string; createdAt:string }
const CONSENTS='rede-maternar:record-consents', ENTRIES='rede-maternar:record-entries'
const seedConsents:RecordConsent[]=[{patientId:'patient-1',globalConsent:true,professionalIds:['professional-1'],updatedAt:'2026-07-28T12:00:00.000Z'}]
const seedEntries:RecordEntry[]=[{id:'entry-1',patientId:'patient-1',professionalId:'professional-1',type:'report',title:'Relatório de evolução',content:'Avaliação inicial realizada. Recomendada continuidade do acompanhamento integrado e observação dos sinais descritos no plano de cuidados.',createdAt:'2026-07-28T13:00:00.000Z'}]
function read<T>(k:string,f:T):T{if(typeof window==='undefined')return f;const r=localStorage.getItem(k);if(!r){localStorage.setItem(k,JSON.stringify(f));return f}try{return JSON.parse(r) as T}catch{return f}}
function write<T>(k:string,v:T){if(typeof window!=='undefined')localStorage.setItem(k,JSON.stringify(v))}
export function getConsent(patientId:string){return read<RecordConsent[]>(CONSENTS,seedConsents).find(c=>c.patientId===patientId)??{patientId,globalConsent:false,professionalIds:[],updatedAt:new Date().toISOString()}}
export function saveConsent(consent:RecordConsent){const all=read<RecordConsent[]>(CONSENTS,seedConsents);write(CONSENTS,[consent,...all.filter(c=>c.patientId!==consent.patientId)])}
export function addRecordEntry(input:Omit<RecordEntry,'id'|'createdAt'>){const e={...input,id:crypto.randomUUID(),createdAt:new Date().toISOString()};write(ENTRIES,[e,...read<RecordEntry[]>(ENTRIES,seedEntries)]);return e}
export function getPatientEntries(patientId:string,viewerProfessionalId?:string){const consent=getConsent(patientId);if(viewerProfessionalId&&!consent.professionalIds.includes(viewerProfessionalId))return[];return read<RecordEntry[]>(ENTRIES,seedEntries).filter(e=>e.patientId===patientId).map(e=>({...e,professional:getUsers().find(u=>u.id===e.professionalId)}))}
