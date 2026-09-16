import { useEffect, useMemo, useState } from 'react'
import { addHealthPlanEntry, createHealthPlan, listHealthPlanEntries, listHealthPlans, updateHealthPlanStatus, type HealthPlan, type HealthPlanEntry } from '../../lib/clinicalIntelligence'
import type { PatientDocument } from '../../lib/operations'

const categories=['alimentação','hidratação','sono','atividade física','amamentação','medicação','suplementação','exercícios','fisioterapia','saúde mental','rotina','outros']
const date=value=>value?new Date(value).toLocaleDateString('pt-BR'):'Não informado'
const dateTime=value=>value?new Date(value).toLocaleString('pt-BR'):'Não informado'
type ClinicalDetail={patient:{id:string;full_name:string;birth_date?:string|null};appointments:any[];records:any[];finance:any[]}
type Section='resumo'|'linha'|'consultas'|'exames'|'habitos'|'ia'

export function ClinicalIntelligence({detail,documents}:{detail:ClinicalDetail;documents:PatientDocument[]}) {
  const patientId=detail.patient.id
  const [section,setSection]=useState<Section>('resumo')
  const [plans,setPlans]=useState<HealthPlan[]>([])
  const [entries,setEntries]=useState<HealthPlanEntry[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  async function refresh(){
    setLoading(true)
    try{const [nextPlans,nextEntries]=await Promise.all([listHealthPlans(patientId),listHealthPlanEntries(patientId)]);setPlans(nextPlans);setEntries(nextEntries);setError('')}
    catch{setError('Os planos ainda não estão disponíveis. O banco pode estar temporariamente restrito ou a atualização pode estar pendente.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void refresh()},[patientId])
  const sortedAppointments=[...detail.appointments].sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at))
  const now=Date.now()
  const nextAppointment=[...detail.appointments].filter(item=>Date.parse(item.starts_at)>=now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0]
  const lastAppointment=sortedAppointments.find(item=>Date.parse(item.starts_at)<now)
  const activePlans=plans.filter(plan=>plan.status==='ativo')
  const timeline=useMemo(()=>[
    ...detail.appointments.map(item=>({id:`a-${item.id}`,when:item.starts_at,title:`Consulta: ${item.procedure_name||'Atendimento'}`,description:item.status||''})),
    ...detail.records.map(item=>({id:`r-${item.id}`,when:item.created_at,title:'Evolução no prontuário',description:'Registro clínico disponível na aba Prontuário.'})),
    ...documents.map(item=>({id:`d-${item.id}`,when:item.created_at,title:`Documento: ${item.title}`,description:item.document_type})),
    ...plans.map(item=>({id:`p-${item.id}`,when:item.created_at,title:`Plano: ${item.title}`,description:item.status})),
    ...entries.map(item=>({id:`e-${item.id}`,when:item.created_at,title:'Acompanhamento de hábito',description:item.value})),
  ].sort((a,b)=>Date.parse(b.when)-Date.parse(a.when)),[detail.appointments,detail.records,documents,plans,entries])

  async function submitPlan(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();const form=event.currentTarget,fields=new FormData(form)
    setBusy(true);setError('');setNotice('')
    try{await createHealthPlan(patientId,{category:String(fields.get('category')),title:String(fields.get('title')),description:String(fields.get('description')||''),frequency:String(fields.get('frequency')||''),goal:String(fields.get('goal')||''),startsOn:String(fields.get('startsOn')),endsOn:String(fields.get('endsOn')||''),notes:String(fields.get('notes')||'')});form.reset();await refresh();setNotice('Plano registrado no histórico do paciente.')}
    catch{setError('Não foi possível salvar o plano. Confira sua permissão e tente novamente quando o banco estiver disponível.')}
    finally{setBusy(false)}
  }
  async function submitEntry(event:React.FormEvent<HTMLFormElement>,planId:string){
    event.preventDefault();const form=event.currentTarget,fields=new FormData(form)
    setBusy(true);setError('');setNotice('')
    try{await addHealthPlanEntry(patientId,planId,{observedOn:String(fields.get('observedOn')),value:String(fields.get('value')),notes:String(fields.get('notes')||'')});form.reset();await refresh();setNotice('Acompanhamento registrado.')}
    catch{setError('Não foi possível registrar o acompanhamento. Tente novamente quando o banco estiver disponível.')}
    finally{setBusy(false)}
  }

  return <section className="clinical-intelligence">
    <div className="section-heading"><div><h3>Inteligência Clínica</h3><p className="muted">Resumo estruturado a partir do histórico real. Nenhuma decisão clínica é automatizada.</p></div></div>
    <nav className="finance-tabs crm-tabs" aria-label="Inteligência Clínica">{([['resumo','Resumo'],['linha','Linha do tempo'],['consultas','Consultas'],['exames','Exames'],['habitos','Hábitos e planos'],['ia','IA e transcrição']] as const).map(([id,label])=><button type="button" key={id} className={section===id?'active':''} onClick={()=>setSection(id)}>{label}</button>)}</nav>
    {notice&&<div className="success-banner">{notice}</div>}{error&&<div className="alert alert-error">{error}</div>}
    {section==='resumo'&&<><div className="grid grid-3"><div className="card"><h4>Próxima consulta</h4><p>{nextAppointment?dateTime(nextAppointment.starts_at):'Nenhuma agendada'}</p></div><div className="card"><h4>Última consulta</h4><p>{lastAppointment?dateTime(lastAppointment.starts_at):'Sem histórico'}</p></div><div className="card"><h4>Planos ativos</h4><p>{loading?'Carregando…':activePlans.length}</p></div><div className="card"><h4>Última evolução</h4><p>{detail.records.length?dateTime(detail.records[0].created_at):'Sem registro'}</p></div><div className="card"><h4>Documentos</h4><p>{documents.length}</p></div><div className="card"><h4>Nascimento</h4><p>{detail.patient.birth_date?date(`${detail.patient.birth_date}T12:00:00`):'Não informado'}</p></div></div><p className="muted">Resumo determinístico para preparação da consulta; confirme os dados no prontuário antes de utilizá-los.</p></>}
    {section==='linha'&&<div className="contact-timeline">{timeline.map(item=><article key={item.id}><strong>{item.title}</strong><small>{dateTime(item.when)}</small><p>{item.description}</p></article>)}{!timeline.length&&<p className="muted">Nenhum evento clínico registrado.</p>}</div>}
    {section==='consultas'&&<div className="contact-timeline">{sortedAppointments.map(item=><article key={item.id}><strong>{item.procedure_name||'Atendimento'}</strong><small>{dateTime(item.starts_at)} · {item.status}</small></article>)}{!sortedAppointments.length&&<p className="muted">Nenhuma consulta registrada.</p>}</div>}
    {section==='exames'&&<div className="contact-timeline">{documents.filter(item=>item.document_type==='attachment').map(item=><article key={item.id}><strong>{item.title}</strong><small>{dateTime(item.created_at)}</small><p>Arquivo privado disponível na aba Documentos. Análise automática requer configuração futura.</p></article>)}{!documents.some(item=>item.document_type==='attachment')&&<p className="muted">Nenhum exame ou anexo registrado.</p>}</div>}
    {section==='habitos'&&<><form className="form-grid card" onSubmit={submitPlan}><h4 className="field-span-2">Novo plano de acompanhamento</h4><label className="field"><span>Categoria</span><select name="category">{categories.map(item=><option key={item}>{item}</option>)}</select></label><label className="field"><span>Título</span><input name="title" minLength={3} maxLength={160} required/></label><label className="field field-span-2"><span>Descrição</span><textarea name="description" rows={2}/></label><label className="field"><span>Frequência</span><input name="frequency" placeholder="Ex.: diariamente"/></label><label className="field"><span>Meta</span><input name="goal" placeholder="Ex.: registro diário"/></label><label className="field"><span>Início</span><input name="startsOn" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label className="field"><span>Fim (opcional)</span><input name="endsOn" type="date"/></label><label className="field field-span-2"><span>Observações</span><textarea name="notes" rows={2}/></label><button className="btn btn-primary field-span-2" disabled={busy||loading||!!error}>{busy?'Salvando…':'Salvar plano'}</button></form><div className="contact-timeline">{plans.map(plan=><article key={plan.id}><strong>{plan.title}</strong><small>{plan.category} · {plan.status} · início {date(`${plan.starts_on}T12:00:00`)}</small><p>{plan.description||plan.goal||'Sem descrição adicional.'}</p><div className="row"><label>Status <select value={plan.status} disabled={busy} onChange={async event=>{setBusy(true);try{await updateHealthPlanStatus(patientId,plan.id,event.target.value as HealthPlan['status']);await refresh()}catch{setError('Não foi possível atualizar o plano.')}finally{setBusy(false)}}}><option>ativo</option><option>concluído</option><option>pausado</option><option>cancelado</option></select></label></div>{plan.status==='ativo'&&<form className="form-grid" onSubmit={event=>void submitEntry(event,plan.id)}><label className="field"><span>Data do acompanhamento</span><input name="observedOn" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label className="field"><span>Resultado observado</span><input name="value" maxLength={300} required/></label><label className="field field-span-2"><span>Observações</span><input name="notes"/></label><button className="btn btn-secondary" disabled={busy}>Registrar evolução</button></form>}{entries.filter(entry=>entry.plan_id===plan.id).map(entry=><p key={entry.id}><small>{date(`${entry.observed_on}T12:00:00`)}</small> · {entry.value}</p>)}</article>)}{!loading&&!plans.length&&<p className="muted">Nenhum plano de acompanhamento cadastrado.</p>}</div></>}
    {section==='ia'&&<div className="grid grid-2"><div className="card"><h4>Assistente clínico</h4><p>Requer configuração. Sugestões futuras deverão ser revisadas antes de entrar no prontuário.</p><button className="btn btn-secondary" disabled>Gerar resumo com IA — não configurado</button></div><div className="card"><h4>Transcrição da consulta</h4><p>Não configurada. Nenhuma gravação será iniciada ou enviada automaticamente.</p><button className="btn btn-secondary" disabled>Iniciar gravação — requer configuração</button></div><div className="card"><h4>Análise de documentos</h4><p>Requer configuração. Anexos continuam privados e podem ser consultados na aba Documentos.</p></div><div className="card"><h4>Busca semântica</h4><p>Embeddings desativados; nenhum processamento automático ou custo de IA.</p></div></div>}
  </section>
}
