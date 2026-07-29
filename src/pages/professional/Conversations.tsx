import { useMemo, useRef, useState } from 'react'
import { Bell, FileText, Heart, MessageCircle, Paperclip, Plus, Search, Send, Sparkles, Star, Trash2, X } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { createCarePlan, createTemplate, deleteTemplate, getCarePlansForConversation, getConversationMessages, getMessageTemplates, getProfessionalConversations, markConversationRead, sendMessage, toggleConversationFavorite } from '../../lib/communications'

const fmtTime = (value:string) => new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(value))
const fmtDate = (value:string) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(value))

export function ProfessionalConversations(){
  const { user } = useAuth()
  const [version,setVersion]=useState(0)
  const [query,setQuery]=useState('')
  const conversations = useMemo(()=> user ? getProfessionalConversations(user.id) : [],[user,version])
  const filtered = conversations.filter(item=>item.patient.name.toLowerCase().includes(query.toLowerCase()))
  const [selectedId,setSelectedId]=useState<string|undefined>(conversations[0]?.conversation.id)
  const selected = conversations.find(item=>item.conversation.id===selectedId) || filtered[0]
  const messages = selected ? getConversationMessages(selected.conversation.id) : []
  const plans = selected ? getCarePlansForConversation(selected.conversation.id) : []
  const templates = user ? getMessageTemplates().filter(item=>item.professionalId===user.id) : []
  const [text,setText]=useState('')
  const [showTemplates,setShowTemplates]=useState(false)
  const [showPlan,setShowPlan]=useState(false)
  const [newTemplate,setNewTemplate]=useState(false)
  const fileRef=useRef<HTMLInputElement>(null)

  function refresh(){setVersion(v=>v+1)}
  function select(id:string){setSelectedId(id); if(user) markConversationRead(id,user.id); refresh()}
  function submit(){ if(!user||!selected||!text.trim())return; sendMessage({conversationId:selected.conversation.id,senderId:user.id,senderRole:'professional',kind:'text',text:text.trim()});setText('');refresh() }
  function attach(file?:File){if(!file||!user||!selected)return;sendMessage({conversationId:selected.conversation.id,senderId:user.id,senderRole:'professional',kind:'file',text:`Arquivo enviado: ${file.name}`,attachment:{name:file.name,type:file.type||'arquivo',size:file.size}});refresh()}

  return <div className="chat-page">
    <div className="page-heading"><div><h1>Conversas</h1><p className="muted">Caixa de entrada unificada com a origem de cada mensagem.</p></div><div className="heading-actions"><button className="notification-button" title="3 novas mensagens"><Bell/><span>3</span></button><button className="btn btn-secondary" onClick={()=>setShowTemplates(true)}><Sparkles size={17}/> Modelos</button></div></div>
    <div className="chat-shell card">
      <aside className="conversation-list">
        <div className="search-field"><Search size={17}/><input placeholder="Buscar paciente" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="conversation-scroll">{filtered.map(({patient,conversation},index)=>{const msgs=getConversationMessages(conversation.id);const last=msgs.at(-1);const source=['Instagram Direct','WhatsApp Business','Marketplace','Facebook Messenger'][index%4];const isNew=index===0;return <button key={conversation.id} className={`conversation-item ${selected?.conversation.id===conversation.id?'active':''} ${isNew?'has-new-message':''}`} onClick={()=>select(conversation.id)}><div className="avatar">{patient.name.split(' ').slice(0,2).map(p=>p[0]).join('')}</div><div className="conversation-copy"><div className="conversation-title"><strong>{patient.name}</strong>{conversation.favorite&&<Star size={14} fill="currentColor"/>}{isNew&&<i className="unread-dot"/>}</div><span>{last?.text || 'Conversa iniciada'}</span><em className="message-source">{source}</em></div><small>{last?fmtTime(last.createdAt):''}</small></button>})}{filtered.length===0&&<div className="empty-mini">Nenhuma paciente encontrada.</div>}</div>
      </aside>
      {selected?<section className="conversation-panel">
        <header className="chat-header"><div className="row"><div className="avatar">{selected.patient.name.split(' ').slice(0,2).map(p=>p[0]).join('')}</div><div><strong>{selected.patient.name}</strong><small>Origem: Instagram Direct · paciente vinculada</small></div></div><div className="row"><button className="icon-btn" title="Favoritar" onClick={()=>{toggleConversationFavorite(selected.conversation.id);refresh()}}><Star size={18} fill={selected.conversation.favorite?'currentColor':'none'}/></button><button className="btn btn-secondary" onClick={()=>setShowPlan(true)}><Heart size={17}/> Plano de cuidados</button></div></header>
        {plans.length>0&&<div className="care-plan-strip"><Heart size={17}/><div><strong>{plans[0].title}</strong><span>{plans[0].tasks.filter(t=>t.completed).length} de {plans[0].tasks.length} etapas concluídas</span></div><div className="mini-progress"><i style={{width:`${plans[0].tasks.length?plans[0].tasks.filter(t=>t.completed).length/plans[0].tasks.length*100:0}%`}}/></div></div>}
        <div className="messages-area">{messages.map(message=><div key={message.id} className={`message-row ${message.senderId===user?.id?'mine':''}`}><div className={`message-bubble ${message.kind}`}>
          {message.kind==='file'&&<FileText size={20}/>} {message.kind==='care-plan'&&<Heart size={20}/>}<span>{message.text}</span>{message.attachment&&<small>{(message.attachment.size/1024).toFixed(1)} KB</small>}<time>{fmtDate(message.createdAt)} · {fmtTime(message.createdAt)} {message.senderId===user?.id&&`· ${message.status==='read'?'Lida':'Enviada'}`}</time>
        </div></div>)}</div>
        <footer className="composer"><button className="icon-btn" onClick={()=>fileRef.current?.click()}><Paperclip size={19}/></button><input ref={fileRef} type="file" hidden onChange={e=>attach(e.target.files?.[0])}/><button className="icon-btn" onClick={()=>setShowTemplates(true)}><Sparkles size={19}/></button><textarea rows={1} placeholder="Escreva uma mensagem..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}}/><button className="btn btn-primary" onClick={submit}><Send size={17}/></button></footer>
      </section>:<div className="empty-chat"><MessageCircle size={42}/><h3>Selecione uma conversa</h3></div>}
    </div>
    {showTemplates&&<TemplateModal templates={templates} onClose={()=>setShowTemplates(false)} onUse={content=>{setText(content);setShowTemplates(false)}} onCreate={()=>setNewTemplate(true)} onDelete={id=>{deleteTemplate(id);refresh()}}/>}
    {newTemplate&&user&&<NewTemplateModal professionalId={user.id} onClose={()=>setNewTemplate(false)} onSaved={()=>{setNewTemplate(false);refresh()}}/>}
    {showPlan&&selected&&user&&<CarePlanModal patientName={selected.patient.name} onClose={()=>setShowPlan(false)} onSave={(title,introduction,tasks)=>{createCarePlan({conversationId:selected.conversation.id,patientId:selected.patient.id,professionalId:user.id,title,introduction,tasks});setShowPlan(false);refresh()}}/>}
  </div>
}

function TemplateModal({templates,onClose,onUse,onCreate,onDelete}:{templates:any[];onClose:()=>void;onUse:(v:string)=>void;onCreate:()=>void;onDelete:(id:string)=>void}){return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><h2>Modelos de mensagem</h2><p className="muted">Orientações frequentes prontas para personalizar.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div><div className="template-list">{templates.map(t=><div className="template-card" key={t.id}><span className="badge">{t.category}</span><h3>{t.title}</h3><p>{t.content}</p><div className="row"><button className="btn btn-primary" onClick={()=>onUse(t.content)}>Usar modelo</button><button className="icon-btn" onClick={()=>onDelete(t.id)}><Trash2 size={17}/></button></div></div>)}</div><button className="btn btn-secondary" onClick={onCreate}><Plus size={17}/> Criar modelo</button></div></div>}
function NewTemplateModal({professionalId,onClose,onSaved}:{professionalId:string;onClose:()=>void;onSaved:()=>void}){const[title,setTitle]=useState('');const[category,setCategory]=useState('Orientação');const[content,setContent]=useState('');return <div className="modal-backdrop modal-top"><div className="modal-card small"><div className="modal-head"><h2>Novo modelo</h2><button className="icon-btn" onClick={onClose}><X/></button></div><div className="field"><label>Título</label><input value={title} onChange={e=>setTitle(e.target.value)}/></div><div className="field"><label>Categoria</label><input value={category} onChange={e=>setCategory(e.target.value)}/></div><div className="field"><label>Mensagem</label><textarea rows={6} value={content} onChange={e=>setContent(e.target.value)}/></div><button className="btn btn-primary" onClick={()=>{if(title.trim()&&content.trim()){createTemplate({professionalId,title,category,content});onSaved()}}}>Salvar modelo</button></div></div>}
function CarePlanModal({patientName,onClose,onSave}:{patientName:string;onClose:()=>void;onSave:(t:string,i:string,tasks:{title:string;details:string}[])=>void}){const[title,setTitle]=useState('Plano de cuidados — próximos dias');const[intro,setIntro]=useState('');const[tasks,setTasks]=useState([{title:'',details:''},{title:'',details:''},{title:'',details:''}]);return <div className="modal-backdrop"><div className="modal-card"><div className="modal-head"><div><h2>Plano de cuidados</h2><p className="muted">Crie um acompanhamento claro para {patientName}.</p></div><button className="icon-btn" onClick={onClose}><X/></button></div><div className="field"><label>Título</label><input value={title} onChange={e=>setTitle(e.target.value)}/></div><div className="field"><label>Mensagem de acolhimento</label><textarea rows={3} value={intro} onChange={e=>setIntro(e.target.value)} placeholder="Explique o foco deste plano sem sobrecarregar a paciente."/></div><h3>Etapas</h3>{tasks.map((task,index)=><div className="task-editor" key={index}><input placeholder={`Etapa ${index+1}`} value={task.title} onChange={e=>setTasks(tasks.map((t,i)=>i===index?{...t,title:e.target.value}:t))}/><input placeholder="Detalhes opcionais" value={task.details} onChange={e=>setTasks(tasks.map((t,i)=>i===index?{...t,details:e.target.value}:t))}/></div>)}<button className="btn btn-secondary" onClick={()=>setTasks([...tasks,{title:'',details:''}])}><Plus size={17}/> Adicionar etapa</button><div className="modal-actions"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={()=>title.trim()&&tasks.some(t=>t.title.trim())&&onSave(title,intro,tasks)}>Enviar plano</button></div></div></div>}
