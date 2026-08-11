import { useRef, useState } from 'react'
import { CheckCircle2, FileText, Heart, MessageCircle, Paperclip, Send } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getCarePlansForConversation, getConversationForPatient, getConversationMessages, getConversationParticipant, markConversationRead, sendMessage, toggleCarePlanTask } from '../../lib/communications'

const fmt=(v:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v))
export function PatientConversations(){
 const{user}=useAuth();const[version,setVersion]=useState(0);const[text,setText]=useState('');const fileRef=useRef<HTMLInputElement>(null)
 const conversation=user?getConversationForPatient(user.id):null
 if(conversation&&user)markConversationRead(conversation.id,user.id)
 const professional=conversation?getConversationParticipant(conversation.professionalId):null
 const messages=conversation?getConversationMessages(conversation.id):[]
 const plans=conversation?getCarePlansForConversation(conversation.id):[]
 function refresh(){setVersion(v=>v+1)}
 function submit(){if(!conversation||!user||!text.trim())return;sendMessage({conversationId:conversation.id,senderId:user.id,senderRole:'patient',kind:'text',text:text.trim()});setText('');refresh()}
 function attach(file?:File){if(!file||!conversation||!user)return;sendMessage({conversationId:conversation.id,senderId:user.id,senderRole:'patient',kind:'file',text:`Arquivo enviado: ${file.name}`,attachment:{name:file.name,type:file.type||'arquivo',size:file.size}});refresh()}
 if(!conversation)return <div className="card empty-state"><MessageCircle size={40}/><h3>Nenhuma conversa disponível</h3><p className="muted">Sua conversa aparecerá quando houver uma profissional vinculada.</p></div>
 return <div className="patient-chat-page"><div className="page-heading"><div><h1>Conversa</h1><p className="muted">Seu canal exclusivo com {professional?.name||'sua profissional'}.</p></div></div>
 <div className="patient-care-grid">
  <section className="card patient-conversation"><header className="chat-header"><div className="row"><div className="avatar">{professional?.name.split(' ').slice(0,2).map(p=>p[0]).join('')}</div><div><strong>{professional?.name}</strong><small>{professional?.specialty||'Profissional da MaterPlace'}</small></div></div></header><div className="messages-area">{messages.map(m=><div key={m.id} className={`message-row ${m.senderId===user?.id?'mine':''}`}><div className={`message-bubble ${m.kind}`}>{m.kind==='file'&&<FileText size={19}/>} {m.kind==='care-plan'&&<Heart size={19}/>}<span>{m.text}</span><time>{fmt(m.createdAt)}{m.senderId===user?.id&&` · ${m.status==='read'?'Lida':'Enviada'}`}</time></div></div>)}</div><footer className="composer"><button className="icon-btn" onClick={()=>fileRef.current?.click()}><Paperclip size={19}/></button><input ref={fileRef} hidden type="file" accept="image/*,.pdf,.doc,.docx" onChange={e=>attach(e.target.files?.[0])}/><textarea rows={1} value={text} onChange={e=>setText(e.target.value)} placeholder="Escreva sua mensagem..." onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}}/><button className="btn btn-primary" onClick={submit}><Send size={17}/></button></footer></section>
  <aside className="care-plans-column"><div className="section-mini-title"><Heart size={18}/><strong>Meus planos de cuidados</strong></div>{plans.length===0?<div className="card"><p className="muted">Quando sua profissional enviar um plano, ele aparecerá aqui.</p></div>:plans.map(plan=>{const done=plan.tasks.filter(t=>t.completed).length;return <div className="card care-plan-card" key={plan.id}><div className="care-plan-title"><div><span className={`status ${plan.status==='completed'?'status-active':'status-pending'}`}>{plan.status==='completed'?'Concluído':'Em andamento'}</span><h3>{plan.title}</h3></div><strong>{done}/{plan.tasks.length}</strong></div>{plan.introduction&&<p className="muted">{plan.introduction}</p>}<div className="progress"><i style={{width:`${plan.tasks.length?done/plan.tasks.length*100:0}%`}}/></div><div className="care-task-list">{plan.tasks.map(task=><button key={task.id} className={`care-task ${task.completed?'done':''}`} onClick={()=>{toggleCarePlanTask(plan.id,task.id);refresh()}}><span className="check-circle">{task.completed?<CheckCircle2 size={20}/>:<i/>}</span><span><strong>{task.title}</strong>{task.details&&<small>{task.details}</small>}</span></button>)}</div></div>})}</aside>
 </div></div>
}
