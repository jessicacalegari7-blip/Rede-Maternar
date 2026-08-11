import { useEffect, useState } from 'react'
import { CalendarDays, Check, Plus, RefreshCw, X } from 'lucide-react'
import {
  createAppointment, listAppointments, listOrganizationProfessionals, listPatients,
  markAppointmentPaid, updateAppointment, type RealAppointment,
} from '../../lib/operations'

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const labels:Record<RealAppointment['status'],string>={
  scheduled:'Agendada',confirmed:'Confirmada',in_service:'Em atendimento',completed:'Concluída',cancelled:'Cancelada',no_show:'Não compareceu',
}

export function ProfessionalAgenda(){
  const [items,setItems]=useState<RealAppointment[]>([])
  const [patients,setPatients]=useState<any[]>([])
  const [professionals,setProfessionals]=useState<any[]>([])
  const [show,setShow]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  async function load(){setError('');try{const [a,p,pr]=await Promise.all([listAppointments(),listPatients(),listOrganizationProfessionals()]);setItems(a);setPatients(p);setProfessionals(pr)}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar agenda.')}}
  useEffect(()=>{void load()},[])
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const starts=new Date(String(f.get('starts')));const duration=Number(f.get('duration'));const ends=new Date(starts.getTime()+duration*60000);try{await createAppointment({
    patientId:String(f.get('patient')),professionalId:String(f.get('professional')),startsAt:starts.toISOString(),endsAt:ends.toISOString(),
    price:Number(String(f.get('price')).replace(',','.')),isOnline:f.get('online')==='on',isReturn:f.get('return')==='on',
    isPaidReturn:f.get('paidReturn')==='on',notes:String(f.get('notes')||''),
  });setShow(false);setNotice('Agendamento salvo no banco.');await load()}catch(err){setError(err instanceof Error?err.message:'Falha ao agendar.')}}
  return <><div className="topbar"><div><h1>Agenda</h1><div className="muted">Atendimentos reais da organização.</div></div><div className="row"><button className="icon-btn" title="Atualizar" onClick={()=>void load()}><RefreshCw/></button><button className="btn btn-primary" onClick={()=>setShow(true)}><Plus/> Novo agendamento</button></div></div>
    {error&&<div className="alert alert-error">{error}</div>}{notice&&<div className="success-banner">{notice}</div>}
    <section className="card"><div className="section-heading"><div><h2>Consultas</h2><p className="muted">{items.length} registros salvos</p></div><CalendarDays/></div>
      <div className="appointment-list">{items.map(item=><article className="professional-appointment" key={item.id}><div className="date-tile"><strong>{new Date(item.starts_at).toLocaleDateString('pt-BR',{day:'2-digit'})}</strong><span>{new Date(item.starts_at).toLocaleDateString('pt-BR',{month:'short'})}</span></div><div className="appointment-main"><strong>{item.patient_profiles?.full_name||'Paciente'}</strong><span>{new Date(item.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · {item.professional_profiles?.full_name||'Profissional'}</span><small>{item.is_online?'Online':'Presencial'} · {money.format(item.price_cents/100)}</small></div><span className="status-pill">{labels[item.status]}</span><div className="appointment-actions">{item.status==='scheduled'&&<button className="icon-btn success" title="Confirmar" onClick={async()=>{await updateAppointment(item.id,{status:'confirmed'});await load()}}><Check/></button>}{!['completed','cancelled'].includes(item.status)&&<button className="icon-btn danger" title="Cancelar" onClick={async()=>{await updateAppointment(item.id,{status:'cancelled'});await load()}}><X/></button>} {!['completed','cancelled'].includes(item.status)&&<button className="btn btn-primary btn-small" onClick={async()=>{const method=window.prompt('Forma de pagamento (Pix, dinheiro, cartão...)','Pix');if(method){await markAppointmentPaid(item,method);setNotice('Atendimento e recebimento registrados.');await load()}}}>Marcar pago</button>}</div></article>)}
        {!items.length&&<div className="empty-state"><h3>Nenhum agendamento real</h3><p className="muted">Cadastre a primeira consulta.</p></div>}</div>
    </section>
    {show&&<div className="modal-backdrop"><form className="modal-card customer-form" onSubmit={submit}><div className="modal-head"><div><h2>Novo agendamento</h2><p className="muted">O registro será salvo no Supabase.</p></div><button type="button" className="icon-btn" onClick={()=>setShow(false)}>×</button></div><div className="form-grid"><label className="field"><span>Paciente</span><select name="patient" required><option value="">Selecione</option>{patients.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select></label><label className="field"><span>Profissional</span><select name="professional" required><option value="">Selecione</option>{professionals.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select></label><label className="field"><span>Data e hora</span><input name="starts" type="datetime-local" required/></label><label className="field"><span>Duração (minutos)</span><input name="duration" type="number" min="10" defaultValue="60" required/></label><label className="field"><span>Valor (R$)</span><input name="price" inputMode="decimal" defaultValue="0" required/></label><label className="check-row"><input name="online" type="checkbox"/><span>Consulta online</span></label><label className="check-row"><input name="return" type="checkbox"/><span>É retorno</span></label><label className="check-row"><input name="paidReturn" type="checkbox"/><span>Retorno pago</span></label><label className="field field-span-2"><span>Observações</span><textarea name="notes"/></label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShow(false)}>Cancelar</button><button className="btn btn-primary">Salvar</button></div></form></div>}
  </>
}
