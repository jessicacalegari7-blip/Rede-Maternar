import { useState } from 'react'
import {
  ArrowUpRight, BarChart3, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, KanbanSquare,
  MessageCircle, MoreHorizontal, Plus, Search, TrendingUp, UserRound, Wallet,
} from 'lucide-react'

const leads = [
  { name: 'Juliana Martins', source: 'Marketplace', service: 'Consulta de amamentação', value: 'R$ 220', stage: 'Novo contato' },
  { name: 'Beatriz Lopes', source: 'WhatsApp', service: 'Acompanhamento pós-parto', value: 'R$ 380', stage: 'Em conversa' },
  { name: 'Mariana Alves', source: 'Instagram', service: 'Consulta online', value: 'R$ 180', stage: 'Proposta enviada' },
  { name: 'Camila Prado', source: 'Indicação orgânica', service: 'Avaliação inicial', value: 'R$ 250', stage: 'Agendado' },
]
const stages = ['Novo contato', 'Em conversa', 'Proposta enviada', 'Agendado']

export function CrmPipeline() {
  return <><div className="page-heading"><div><span className="badge">CRM</span><h1>Funil de atendimento</h1><p className="muted">Organize cada oportunidade desde o primeiro contato até o agendamento.</p></div><button className="btn btn-primary"><Plus size={17}/> Nova oportunidade</button></div>
    <div className="pipeline-board">{stages.map(stage => <section className="pipeline-column" key={stage}><header><strong>{stage}</strong><span>{leads.filter(x => x.stage === stage).length}</span></header>{leads.filter(x => x.stage === stage).map(lead => <article className="lead-card" key={lead.name}><div className="row between"><div className="avatar small-avatar">{lead.name.split(' ').map(x=>x[0]).slice(0,2)}</div><MoreHorizontal size={18}/></div><h3>{lead.name}</h3><p>{lead.service}</p><div className="lead-meta"><span>{lead.source}</span><strong>{lead.value}</strong></div><button className="lead-action">Abrir oportunidade <ArrowUpRight size={15}/></button></article>)}</section>)}</div>
  </>
}

export function CrmCustomers() {
  const [showForm,setShowForm]=useState(false)
  const [saved,setSaved]=useState('')
  const [stage,setStage]=useState('Novo contato')
  function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);setSaved(`${data.get('name')} entrou no CRM em “${stage}”.`);setShowForm(false)}
  return <><div className="page-heading"><div><span className="badge">CRM</span><h1>Clientes</h1><p className="muted">Contatos, histórico comercial, agendamentos e pendências em um só lugar.</p></div><button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={17}/> Cadastrar paciente</button></div>
    {saved&&<div className="success-banner"><CheckCircle2 size={18}/>{saved}</div>}
    <div className="grid grid-4"><Metric label="Clientes ativos" value="148"/><Metric label="Novos no mês" value="19"/><Metric label="Retorno previsto" value="12"/><Metric label="Sem contato há 30 dias" value="8"/></div>
    <div className="card" style={{marginTop:18}}><div className="section-heading"><div><h2>Base de clientes</h2><p className="muted">O indicador de comparecimento é privado e calculado somente com o histórico objetivo de agendamentos.</p></div><div className="search-field"><Search size={17}/><input placeholder="Buscar por nome, telefone ou e-mail"/></div></div><div className="crm-table">{['Camila Ribeiro','Juliana Martins','Beatriz Lopes','Mariana Alves','Ana Carolina'].map((name,i)=>{const attendance=[{rate:100,done:8,missed:0},{rate:86,done:6,missed:1},{rate:67,done:2,missed:1},{rate:92,done:11,missed:1},{rate:100,done:1,missed:0}][i];return <div className="crm-row" key={name}><div className="avatar"><UserRound size={18}/></div><div><strong>{name}</strong><small>{['(11) 98765-1122','(11) 99921-8044','(21) 98840-7712','(19) 99741-6630','(11) 98122-4439'][i]}</small></div><span className="badge">{i<2?'Atendimento ativo':i===2?'Proposta enviada':'Acompanhamento'}</span><div className={`attendance-score ${attendance.rate<75?'attention':''}`} title="Indicador privado baseado em consultas concluídas e ausências"><strong>{attendance.rate}%</strong><span>Comparecimento</span><small>{attendance.done} realizadas · {attendance.missed} ausência{attendance.missed===1?'':'s'}</small></div><div><strong>{['Hoje, 14:30','Amanhã, 09:00','12 ago, 16:00','18 ago, 10:30','Sem retorno'][i]}</strong><small>Próxima atividade</small></div><button className="icon-btn"><ArrowUpRight size={17}/></button></div>})}</div></div>
    {showForm&&<div className="modal-backdrop"><form className="modal-card customer-form" onSubmit={submit}><div className="modal-head"><div><span className="badge">Cadastro manual</span><h2>Nova paciente ou contato</h2><p className="muted">Cadastre quem chegou por telefone, recepção, Instagram ou outra origem. O registro entra automaticamente no funil.</p></div><button type="button" className="icon-btn" onClick={()=>setShowForm(false)}>×</button></div><div className="form-grid"><label className="field"><span>Nome completo</span><input name="name" required/></label><label className="field"><span>WhatsApp</span><input name="phone" placeholder="(11) 99999-9999" required/></label><label className="field"><span>E-mail</span><input name="email" type="email"/></label><label className="field"><span>Origem</span><select name="source" defaultValue="Cadastro manual"><option>Cadastro manual</option><option>Ligação telefônica</option><option>Recepção</option><option>Instagram</option><option>Marketplace Rede Maternar</option><option>Outro</option></select></label><label className="field"><span>Serviço de interesse</span><select name="service"><option>Consulta inicial</option><option>Consulta online</option><option>Acompanhamento pós-parto</option><option>Retorno</option><option>Ainda não definido</option></select></label><label className="field"><span>Entrada no funil</span><select value={stage} onChange={e=>setStage(e.target.value)}><option>Novo contato</option><option>Em conversa</option><option>Proposta enviada</option><option>Agendado</option><option>Cliente ativo</option></select></label><label className="field field-span-2"><span>Observações administrativas</span><input name="note" placeholder="Preferência de horário, modalidade ou forma de contato"/></label></div><div className="crm-routing-note"><KanbanSquare size={20}/><span><strong>Destino automático: {stage}</strong><small>Contatos vindos do WhatsApp entram em “Novo contato”. No cadastro manual, você pode escolher a etapa inicial.</small></span></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancelar</button><button className="btn btn-primary">Salvar e adicionar ao funil</button></div></form></div>}
  </>
}

export function ErpServices() {
  const [active,setActive]=useState(true)
  return <><div className="page-heading"><div><span className="badge">Catálogo</span><h1>Serviços e preços</h1><p className="muted">O mesmo catálogo alimenta o Marketplace, a agenda e o financeiro.</p></div><button className="btn btn-primary"><Plus size={17}/> Novo serviço</button></div>
    <div className="grid grid-3">{[
      ['Consulta inicial','60 min','R$ 220,00','Presencial e online'],
      ['Retorno','40 min','R$ 150,00','Online'],
      ['Acompanhamento pós-parto','90 min','R$ 380,00','Domiciliar'],
    ].map(([name,duration,price,mode],i)=><article className="card service-admin-card" key={name}><div className="row between"><span className="badge">{i===0?'Mais contratado':'Ativo'}</span><button className="icon-btn"><MoreHorizontal size={18}/></button></div><h2>{name}</h2><p className="muted">{mode}</p><div className="service-price">{price}</div><div className="row muted"><Clock3 size={16}/>{duration}</div><label className="switch-row"><input type="checkbox" checked={i===0?active:true} onChange={()=>i===0&&setActive(!active)}/><span>Publicado no Marketplace</span></label></article>)}</div>
  </>
}

export function ErpReports() {
  return <><div className="page-heading"><div><span className="badge">ERP</span><h1>Relatórios do negócio</h1><p className="muted">Acompanhe receita, ocupação, origem dos clientes e desempenho do Marketplace.</p></div><button className="btn btn-secondary">Exportar relatório</button></div>
    <div className="grid grid-4"><Metric label="Receita no mês" value="R$ 12.480"/><Metric label="Ticket médio" value="R$ 246"/><Metric label="Taxa de conversão" value="31%"/><Metric label="Ocupação da agenda" value="74%"/></div>
    <div className="grid grid-2" style={{marginTop:18}}><div className="card"><h2>Receita dos últimos 6 meses</h2><div className="bar-chart">{[42,57,49,68,74,88].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><span>{['Fev','Mar','Abr','Mai','Jun','Jul'][i]}</span></div>)}</div></div><div className="card"><h2>Origem das oportunidades</h2>{[['Marketplace Rede Maternar','42%'],['WhatsApp Business','31%'],['Instagram','18%'],['Outros','9%']].map(([label,value])=><div className="report-line" key={label}><span>{label}</span><div className="progress"><i style={{width:value}}/></div><strong>{value}</strong></div>)}</div></div>
  </>
}

export function ProfessionalOverview() {
  return <><div className="topbar"><div><span className="badge">Gestão Completa</span><h1>Bom dia, Marina</h1><div className="muted">Sua operação profissional em um só lugar.</div></div><button className="btn btn-primary"><Plus size={17}/> Novo atendimento</button></div>
    <div className="grid grid-4"><Metric label="Receita do mês" value="R$ 12.480"/><Metric label="Agenda hoje" value="6 atendimentos"/><Metric label="Oportunidades abertas" value="14"/><Metric label="Visitas no perfil" value="327"/></div>
    <div className="grid grid-2" style={{marginTop:18}}><div className="card"><div className="section-heading"><h2>Próximas atividades</h2><CalendarClock/></div>{['09:30 · Consulta com Camila Ribeiro','11:00 · Retornar contato de Juliana','14:30 · Atendimento com Beatriz','17:00 · Enviar proposta para Mariana'].map((x,i)=><div className="list-item" key={x}><span>{x}</span>{i===0?<span className="badge">Agora</span>:<CheckCircle2 size={18} className="muted"/>}</div>)}</div><div className="card"><div className="section-heading"><h2>Central de atendimento</h2><MessageCircle/></div><div className="integration-card"><div className="integration-icon">WA</div><div><strong>WhatsApp Business</strong><p className="muted">Conecte seu número para receber e responder mensagens dentro do CRM.</p></div><button className="btn btn-secondary">Configurar</button></div><div className="list-item"><span>Mensagens aguardando resposta</span><strong>7</strong></div><div className="list-item"><span>Tempo médio de resposta</span><strong>18 min</strong></div></div></div>
  </>
}

function Metric({label,value}:{label:string,value:string}) {
  const icons=[CircleDollarSign,TrendingUp,BarChart3,Wallet]; const Icon=icons[label.length%icons.length]
  return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>
}
