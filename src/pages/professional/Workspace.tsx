import { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowUpRight, BarChart3, Bell, CalendarClock, CheckCircle2, CircleDollarSign, Clock3, KanbanSquare,
  MessageCircle, MoreHorizontal, Plus, Search, TrendingUp, UserRound, Wallet,
} from 'lucide-react'
import { createPatientAndLead, createService, listLeads, listPatients, listServices, setServiceActive, updateLeadStage, type LeadStage, type RealLead, type RealService } from '../../lib/operations'

const stages: { id: LeadStage; label: string }[] = [
  { id: 'new', label: 'Novo contato' }, { id: 'first_contact_attempt', label: '1ª tentativa' },
  { id: 'second_contact_attempt', label: '2ª tentativa' }, { id: 'future_contact', label: 'Contato futuro' },
  { id: 'scheduled', label: 'Agendado' },
]

export function CrmPipeline() {
  const [leads,setLeads]=useState<RealLead[]>([])
  const [error,setError]=useState('')
  async function refresh(){try{setLeads(await listLeads())}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o CRM.')}}
  useEffect(()=>{void refresh()},[])
  return <><div className="page-heading"><div><span className="badge">CRM</span><h1>Funil de atendimento</h1><p className="muted">Organize cada oportunidade desde o primeiro contato até o agendamento.</p></div><button className="btn btn-primary"><Plus size={17}/> Nova oportunidade</button></div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="pipeline-board pipeline-five">{stages.map(stage => <section className="pipeline-column" key={stage.id}><header><strong>{stage.label}</strong><span>{leads.filter(x => x.status === stage.id).length}</span></header>{leads.filter(x => x.status === stage.id).map(lead => <article className="lead-card" key={lead.id}><div className="row between"><div className="avatar small-avatar">{lead.full_name.split(' ').map(x=>x[0]).slice(0,2)}</div><MoreHorizontal size={18}/></div><h3>{lead.full_name}</h3><p>{lead.phone||lead.email||'Contato não informado'}</p><div className="lead-meta"><span>{lead.source}</span></div><select value={lead.status} onChange={async e=>{await updateLeadStage(lead.id,e.target.value as LeadStage);await refresh()}}>{stages.map(option=><option value={option.id} key={option.id}>{option.label}</option>)}</select></article>)}</section>)}</div>
  </>
}

export function CrmCustomers() {
  const [showForm,setShowForm]=useState(false)
  const [saved,setSaved]=useState('')
  const [stage,setStage]=useState('Novo contato')
  const [patients,setPatients]=useState<any[]>([])
  const [error,setError]=useState('')
  async function refresh(){try{setPatients(await listPatients())}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar pacientes.')}}
  useEffect(()=>{void refresh()},[])
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);const stageMap:Record<string,LeadStage>={'Novo contato':'new','Em conversa':'first_contact_attempt','Proposta enviada':'second_contact_attempt','Agendado':'scheduled','Cliente ativo':'completed'};try{await createPatientAndLead({name:String(data.get('name')),phone:String(data.get('phone')),email:String(data.get('email')||''),source:String(data.get('source')),stage:stageMap[stage]||'new',notes:String(data.get('note')||'')});setSaved(`${data.get('name')} foi gravada no banco e adicionada ao CRM.`);setShowForm(false);await refresh()}catch(err){setError(err instanceof Error?err.message:'Falha ao salvar cadastro.')}}
  return <><div className="page-heading"><div><span className="badge">CRM</span><h1>Clientes</h1><p className="muted">Contatos, histórico comercial, agendamentos e pendências em um só lugar.</p></div><button className="btn btn-primary" onClick={()=>setShowForm(true)}><Plus size={17}/> Cadastrar paciente</button></div>
    {saved&&<div className="success-banner"><CheckCircle2 size={18}/>{saved}</div>}{error&&<div className="alert alert-error">{error}</div>}
    <div className="grid grid-4"><Metric label="Clientes cadastrados" value={String(patients.length)}/><Metric label="Novos no mês" value={String(patients.filter(x=>new Date(x.created_at).getMonth()===new Date().getMonth()).length)}/><Metric label="Consultas" value={String(patients.reduce((s,x)=>s+(x.appointment_count||0),0))}/><Metric label="Ausências" value={String(patients.reduce((s,x)=>s+(x.no_show_count||0),0))}/></div>
    <div className="card" style={{marginTop:18}}><div className="section-heading"><div><h2>Base de clientes</h2><p className="muted">Dados reais e privados da organização conectada.</p></div><div className="search-field"><Search size={17}/><input placeholder="Buscar por nome, telefone ou e-mail"/></div></div><div className="crm-table">{patients.map(patient=>{const total=patient.appointment_count||0;const missed=patient.no_show_count||0;const rate=total?Math.round((total-missed)/total*100):100;return <div className="crm-row" key={patient.id}><div className="avatar"><UserRound size={18}/></div><div><strong>{patient.full_name}</strong><small>{patient.phone||patient.email||'Contato não informado'}</small></div><span className="badge">Cadastrada</span><div className={`attendance-score ${rate<75?'attention':''}`}><strong>{rate}%</strong><span>Comparecimento</span><small>{total} consultas · {missed} ausências</small></div></div>})}{!patients.length&&<div className="empty-state"><p className="muted">Nenhuma paciente cadastrada.</p></div>}</div></div>
    {showForm&&<div className="modal-backdrop"><form className="modal-card customer-form" onSubmit={submit}><div className="modal-head"><div><span className="badge">Cadastro manual</span><h2>Nova paciente ou contato</h2><p className="muted">Cadastre quem chegou por telefone, recepção, Instagram ou outra origem. O registro entra automaticamente no funil.</p></div><button type="button" className="icon-btn" onClick={()=>setShowForm(false)}>×</button></div><div className="form-grid"><label className="field"><span>Nome completo</span><input name="name" required/></label><label className="field"><span>WhatsApp</span><input name="phone" placeholder="(11) 99999-9999" required/></label><label className="field"><span>E-mail</span><input name="email" type="email"/></label><label className="field"><span>Origem</span><select name="source" defaultValue="Cadastro manual"><option>Cadastro manual</option><option>Ligação telefônica</option><option>Recepção</option><option>Instagram</option><option>Marketplace MaterPlace</option><option>Outro</option></select></label><label className="field"><span>Profissional solicitada</span><select name="professional"><option>Dra. Marina Lopes</option><option>Dra. Camila Rocha</option><option>Fernanda Alves</option><option>Sem preferência</option></select></label><label className="field"><span>Serviço de interesse</span><select name="service"><option>Consulta inicial</option><option>Consulta online</option><option>Acompanhamento pós-parto</option><option>Retorno</option><option>Ainda não definido</option></select></label><label className="field"><span>Entrada no funil</span><select value={stage} onChange={e=>setStage(e.target.value)}><option>Novo contato</option><option>Em conversa</option><option>Proposta enviada</option><option>Agendado</option><option>Cliente ativo</option></select></label><label className="field field-span-2"><span>Observações administrativas</span><input name="note" placeholder="Preferência de horário, modalidade ou forma de contato"/></label></div><div className="crm-routing-note"><KanbanSquare size={20}/><span><strong>Destino automático: {stage}</strong><small>Contatos vindos do WhatsApp entram em “Novo contato”. No cadastro manual, você pode escolher a etapa inicial.</small></span></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancelar</button><button className="btn btn-primary">Salvar e adicionar ao funil</button></div></form></div>}
  </>
}

export function ErpServices() {
  const [services,setServices]=useState<RealService[]>([])
  const [show,setShow]=useState(false)
  const [error,setError]=useState('')
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
  async function refresh(){try{setServices(await listServices())}catch(err){setError(err instanceof Error?err.message:'Não foi possível carregar os serviços.')}}
  useEffect(()=>{void refresh()},[])
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);try{await createService({
    name:String(data.get('name')),description:String(data.get('description')||''),durationMinutes:Number(data.get('duration')),
    price:Number(String(data.get('price')).replace(',','.')),attendanceModes:data.getAll('modes').map(String),
    marketplaceVisible:data.get('marketplace')==='on',professionalName:String(data.get('professionalName')),specialty:String(data.get('specialty')),professionalRegistration:String(data.get('professionalRegistration')),city:String(data.get('city')),neighborhood:String(data.get('neighborhood')),
  });setShow(false);await refresh()}catch(err){setError(err instanceof Error?err.message:'Falha ao salvar serviço.')}}
  return <><div className="page-heading"><div><span className="badge">Catálogo</span><h1>Serviços e preços</h1><p className="muted">O mesmo catálogo alimenta o Marketplace, a agenda e o financeiro.</p></div><button className="btn btn-primary" onClick={()=>setShow(true)}><Plus size={17}/> Novo serviço</button></div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="grid grid-3">{services.map(service=><article className="card service-admin-card" key={service.id}><div className="row between"><span className="badge">{service.active?'Ativo':'Inativo'}</span><button className="icon-btn"><MoreHorizontal size={18}/></button></div><h2>{service.name}</h2><p className="muted">{service.description||service.attendance_modes.join(', ')||'Modalidade não informada'}</p><div className="service-price">{money.format(service.price_cents/100)}</div><div className="row muted"><Clock3 size={16}/>{service.duration_minutes} min</div><label className="switch-row"><input type="checkbox" checked={service.active} onChange={async e=>{await setServiceActive(service.id,e.target.checked);await refresh()}}/><span>Serviço ativo</span></label><small>{service.marketplace_visible?'Publicado no Marketplace':'Somente uso interno'}</small></article>)}</div>
    {!services.length&&!error&&<div className="card empty-state"><p className="muted">Nenhum serviço cadastrado. Use “Novo serviço” para iniciar o catálogo real.</p></div>}
    {show&&<div className="modal-backdrop"><form className="modal-card customer-form" onSubmit={submit}><div className="modal-head"><div><span className="badge">Catálogo real</span><h2>Novo serviço</h2><p className="muted">Este serviço será gravado no banco da organização.</p></div><button type="button" className="icon-btn" onClick={()=>setShow(false)}>×</button></div><div className="form-grid">
      <label className="field"><span>Nome do serviço</span><input name="name" required/></label>
      <label className="field"><span>Nome do médico ou profissional</span><input name="professionalName" required/></label>
      <label className="field"><span>Especialidade</span><input name="specialty" required/></label>
      <label className="field"><span>Número do registro profissional</span><input name="professionalRegistration" placeholder="CRM, CRP, CRN, CREFITO..." required/></label>
      <label className="field"><span>Valor da consulta (R$)</span><input name="price" inputMode="decimal" required/></label>
      <label className="field"><span>Tempo médio da consulta (minutos)</span><input name="duration" type="number" min="5" required/></label>
      <label className="field"><span>Cidade</span><input name="city" required/></label>
      <label className="field"><span>Bairro</span><input name="neighborhood" required/></label>
      <label className="field field-span-2"><span>Descrição</span><input name="description"/></label>
      <label className="check-row"><input type="checkbox" name="modes" value="presencial"/><span>Presencial</span></label><label className="check-row"><input type="checkbox" name="modes" value="online"/><span>Online</span></label><label className="check-row"><input type="checkbox" name="modes" value="domiciliar"/><span>Domiciliar</span></label><label className="check-row"><input type="checkbox" name="marketplace"/><span>Publicar no Marketplace</span></label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShow(false)}>Cancelar</button><button className="btn btn-primary">Salvar serviço</button></div></form></div>}
  </>
}

export function ErpReports() {
  return <><div className="page-heading"><div><span className="badge">ERP</span><h1>Relatórios do negócio</h1><p className="muted">Acompanhe receita, ocupação, origem dos clientes e desempenho do Marketplace.</p></div><button className="btn btn-secondary">Exportar relatório</button></div>
    <div className="grid grid-4"><Metric label="Receita no mês" value="R$ 12.480"/><Metric label="Ticket médio" value="R$ 246"/><Metric label="Taxa de conversão" value="31%"/><Metric label="Ocupação da agenda" value="74%"/></div>
    <div className="grid grid-2" style={{marginTop:18}}><div className="card"><h2>Receita dos últimos 6 meses</h2><div className="bar-chart">{[42,57,49,68,74,88].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><span>{['Fev','Mar','Abr','Mai','Jun','Jul'][i]}</span></div>)}</div></div><div className="card"><h2>Origem das oportunidades</h2>{[['Marketplace MaterPlace','42%'],['WhatsApp Business','31%'],['Instagram','18%'],['Outros','9%']].map(([label,value])=><div className="report-line" key={label}><span>{label}</span><div className="progress"><i style={{width:value}}/></div><strong>{value}</strong></div>)}</div></div>
  </>
}

export function ProfessionalOverview() {
  return <><div className="topbar"><div><span className="badge">Gestão Completa</span><h1>Bom dia, Marina</h1><div className="muted">Sua operação profissional em um só lugar.</div></div><button className="btn btn-primary"><Plus size={17}/> Novo atendimento</button></div>
    <div className="plan-limit-alert"><AlertTriangle/><div><strong>Plano gratuito: 27 de 30 visitas utilizadas</strong><span>Você será avisada novamente ao atingir o limite. Quando as 30 visitas acabarem, o perfil ficará oculto até a renovação mensal ou mudança de plano.</span></div><button className="btn btn-secondary">Ver planos</button></div>
    <div className="grid grid-4"><Metric label="Receita do mês" value="R$ 12.480"/><Metric label="Agenda hoje" value="6 atendimentos"/><Metric label="Oportunidades abertas" value="14"/><Metric label="Visitas no perfil" value="327"/></div>
    <div className="card today-agenda"><div className="section-heading"><div><h2>Agenda do dia</h2><p className="muted">Quarta-feira, 29 de julho · 6 consultas marcadas</p></div><CalendarClock/></div><div className="today-slots">{[['08:00','Camila Ribeiro','Consulta inicial','Pago'],['10:30','Juliana Martins','Retorno gratuito','Confirmada'],['14:30','Beatriz Lopes','Teleconsulta','Aguardando pagamento'],['18:00','Mariana Alves','Retorno pago','Pago']].map(([time,name,service,status])=><article key={time}><strong>{time}</strong><span><b>{name}</b><small>{service}</small></span><em>{status}</em><button className="btn btn-secondary btn-small">Abrir</button></article>)}</div></div>
    <div className="grid grid-2" style={{marginTop:18}}><div className="card"><div className="section-heading"><h2>Notificações da profissional</h2><Bell/></div>{['07:00 · Resumo do dia enviado à Dra. Marina: 6 pacientes','09:30 · Aviso de consulta em 1 hora: Juliana Martins','13:30 · Aviso de consulta em 1 hora: Beatriz Lopes','17:00 · Aviso de consulta em 1 hora: Mariana Alves'].map(x=><div className="list-item" key={x}><span>{x}</span><span className="badge">WhatsApp</span></div>)}</div><div className="card"><div className="section-heading"><h2>Automação de WhatsApp</h2><MessageCircle/></div><div className="integration-card"><div className="integration-icon">WA</div><div><strong>Agenda da profissional protegida</strong><p className="muted">Resumo dos pacientes no início do dia e aviso individual 1 hora antes de cada consulta.</p></div><button className="btn btn-secondary">Configurar</button></div><div className="list-item"><span>Programados para hoje</span><strong>7</strong></div><div className="list-item"><span>Entregues no mês</span><strong>146</strong></div></div></div>
  </>
}

function Metric({label,value}:{label:string,value:string}) {
  const icons=[CircleDollarSign,TrendingUp,BarChart3,Wallet]; const Icon=icons[label.length%icons.length]
  return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>
}
