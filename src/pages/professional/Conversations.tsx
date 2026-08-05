import { useEffect, useState } from 'react'
import { MessageCircle, Plus, RefreshCw, Send } from 'lucide-react'
import {
  createConversation, listConversationMessages, listConversations, queueConversationMessage,
  type RealConversation, type RealConversationMessage,
} from '../../lib/operations'

export function ProfessionalConversations(){
  const [conversations,setConversations]=useState<RealConversation[]>([])
  const [selected,setSelected]=useState<RealConversation|null>(null)
  const [messages,setMessages]=useState<RealConversationMessage[]>([])
  const [show,setShow]=useState(false)
  const [text,setText]=useState('')
  const [error,setError]=useState('')
  async function load(){try{const rows=await listConversations();setConversations(rows);if(!selected&&rows[0])setSelected(rows[0])}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar conversas.')}}
  async function loadMessages(id:string){try{setMessages(await listConversationMessages(id))}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar mensagens.')}}
  useEffect(()=>{void load()},[])
  useEffect(()=>{if(selected)void loadMessages(selected.id)},[selected?.id])
  async function send(){if(!selected||!text.trim())return;try{await queueConversationMessage(selected,text);setText('');await loadMessages(selected.id);await load()}catch(e){setError(e instanceof Error?e.message:'Falha ao enviar mensagem.')}}
  async function add(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{const row=await createConversation({name:String(f.get('name')),phone:String(f.get('phone')),channel:String(f.get('channel')) as RealConversation['channel']});setShow(false);setSelected(row);await load()}catch(err){setError(err instanceof Error?err.message:'Falha ao criar conversa.')}}
  return <><div className="page-heading"><div><span className="badge">CRM</span><h1>Caixa de entrada</h1><p className="muted">Somente conversas reais da organização.</p></div><div className="row"><button className="icon-btn" onClick={()=>void load()}><RefreshCw/></button><button className="btn btn-primary" onClick={()=>setShow(true)}><Plus/> Nova conversa</button></div></div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="conversations-layout"><aside className="conversation-sidebar"><div className="conversation-scroll">{conversations.map(c=><button key={c.id} className={`conversation-item ${selected?.id===c.id?'active':''}`} onClick={()=>setSelected(c)}><div className="avatar">{c.contact_name.split(' ').slice(0,2).map(x=>x[0]).join('')}</div><div className="conversation-copy"><strong>{c.contact_name}</strong><span>{c.contact_phone||'Sem telefone'}</span><em className="message-source">{c.channel==='internal'?'Interno':c.channel==='whatsapp_evolution'?'WhatsApp Evolution':'WhatsApp oficial'}</em></div>{c.unread_count>0&&<i className="unread-dot"/>}</button>)}{!conversations.length&&<div className="empty-mini">Nenhuma conversa real.</div>}</div></aside>
      <section className="chat-panel">{selected?<><header className="chat-header"><div><strong>{selected.contact_name}</strong><span>{selected.contact_phone}</span></div><span className="badge">{selected.channel.replace('_',' ')}</span></header><div className="chat-messages">{messages.map(m=><div key={m.id} className={`message-bubble ${m.direction==='outbound'?'professional':'patient'}`}><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString('pt-BR')} · {m.status}</small></div>)}{!messages.length&&<div className="empty-state"><MessageCircle/><p>Inicie a conversa.</p></div>}</div><div className="message-compose"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Escreva uma mensagem"/><button className="btn btn-primary" onClick={()=>void send()}><Send/> Enviar</button></div></>:<div className="empty-state"><MessageCircle/><h3>Selecione uma conversa</h3></div>}</section>
    </div>
    {show&&<div className="modal-backdrop"><form className="modal-card" onSubmit={add}><div className="modal-head"><h2>Nova conversa</h2><button type="button" className="icon-btn" onClick={()=>setShow(false)}>×</button></div><div className="form-grid"><label className="field"><span>Nome</span><input name="name" required/></label><label className="field"><span>WhatsApp</span><input name="phone" required/></label><label className="field field-span-2"><span>Canal</span><select name="channel"><option value="internal">Conversa interna</option><option value="whatsapp_evolution">WhatsApp via Evolution</option><option value="whatsapp_meta">WhatsApp oficial</option></select></label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShow(false)}>Cancelar</button><button className="btn btn-primary">Criar</button></div></form></div>}
  </>
}
