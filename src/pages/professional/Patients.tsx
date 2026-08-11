import { useMemo, useState } from 'react'
import { Copy, Link2, Mail, Plus, Search, UserRound, XCircle } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { cancelInvitation, createInvitation, getInvitations, getProfessionalPatients, type PatientInvitation } from '../../lib/invitations'

export function ProfessionalPatients() {
  const { user } = useAuth()
  const [invitations, setInvitations] = useState(() => getInvitations())
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState('')
  const [query, setQuery] = useState('')
  const patients = useMemo(() => getProfessionalPatients(user!.id), [user, invitations])
  const ownInvites = invitations.filter(i => i.professionalId === user!.id)
  const [form, setForm] = useState({ patientName: '', patientEmail: '', patientPhone: '', note: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    createInvitation({ professionalId: user!.id, ...form })
    setInvitations(getInvitations()); setForm({ patientName:'', patientEmail:'', patientPhone:'', note:'' }); setShowForm(false)
  }
  function linkFor(invite: PatientInvitation) { return `${window.location.origin}/convite/${invite.token}` }
  async function copy(invite: PatientInvitation) { await navigator.clipboard.writeText(linkFor(invite)); setCopied(invite.id); setTimeout(() => setCopied(''), 1800) }
  function cancel(id: string) { cancelInvitation(id); setInvitations(getInvitations()) }
  const visiblePatients = patients.filter(item => item.patient!.name.toLowerCase().includes(query.toLowerCase()))

  return <>
    <div className="page-heading"><div><h1>Pacientes</h1><p className="muted">Convide pacientes e acompanhe os vínculos criados com você.</p></div><button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}><Plus size={18}/>Convidar paciente</button></div>
    {showForm && <form className="card invite-form" onSubmit={submit}><div className="section-heading"><div><h2>Novo convite</h2><p className="muted">A paciente receberá um link exclusivo para criar a conta.</p></div></div><div className="form-grid">
      <label className="field"><span>Nome da paciente</span><input required value={form.patientName} onChange={e=>setForm({...form,patientName:e.target.value})}/></label>
      <label className="field"><span>E-mail</span><input type="email" required value={form.patientEmail} onChange={e=>setForm({...form,patientEmail:e.target.value})}/></label>
      <label className="field"><span>Telefone</span><input required value={form.patientPhone} onChange={e=>setForm({...form,patientPhone:e.target.value})}/></label>
      <label className="field"><span>Motivo ou observação</span><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Ex.: acompanhamento pós-parto"/></label>
    </div><div className="heading-actions"><button className="btn btn-primary">Gerar convite</button><button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancelar</button></div></form>}

    <div className="grid grid-3" style={{marginBottom:18}}><div className="card"><div className="muted">Pacientes vinculadas</div><div className="metric">{patients.length}</div></div><div className="card"><div className="muted">Convites pendentes</div><div className="metric">{ownInvites.filter(i=>i.status==='pending').length}</div></div><div className="card"><div className="muted">Convites aceitos</div><div className="metric">{ownInvites.filter(i=>i.status==='accepted').length}</div></div></div>

    <div className="card" style={{marginBottom:18}}><div className="section-heading"><div><h2>Minhas pacientes</h2></div><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar paciente"/></div></div>{visiblePatients.length ? <div className="list">{visiblePatients.map(({patient,link})=><div className="list-item" key={link.patientId}><div className="row"><div className="avatar"><UserRound size={19}/></div><div><strong>{patient!.name}</strong><div className="muted">{patient!.email}</div></div></div><span className="badge">Vinculada</span></div>)}</div> : <div className="empty-state"><h3>Nenhuma paciente vinculada ainda</h3><p className="muted">Assim que um convite for aceito, a paciente aparecerá aqui.</p></div>}</div>

    <div className="card"><div className="section-heading"><div><h2>Convites enviados</h2><p className="muted">Copie o link e envie pelo WhatsApp ou e-mail.</p></div></div>{ownInvites.length ? <div className="invite-list">{ownInvites.map(invite=><div className="invite-row" key={invite.id}><div><strong>{invite.patientName}</strong><div className="muted">{invite.patientEmail} · {invite.patientPhone}</div>{invite.note && <small>{invite.note}</small>}</div><span className={`status status-${invite.status==='accepted'?'active':invite.status==='cancelled'?'rejected':'pending'}`}>{invite.status==='pending'?'Aguardando cadastro':invite.status==='accepted'?'Aceito':'Cancelado'}</span><div className="action-buttons">{invite.status==='pending' && <><button className="icon-btn" title="Copiar link" onClick={()=>copy(invite)}>{copied===invite.id?'✓':<Copy size={17}/>}</button><a className="icon-btn" title="Abrir convite" href={linkFor(invite)} target="_blank"><Link2 size={17}/></a><a className="icon-btn" title="Enviar por e-mail" href={`mailto:${invite.patientEmail}?subject=Seu convite para a MaterPlace&body=${encodeURIComponent(`Olá, ${invite.patientName}! Criei seu acesso: ${linkFor(invite)}`)}`}><Mail size={17}/></a><button className="icon-btn reject" title="Cancelar" onClick={()=>cancel(invite.id)}><XCircle size={17}/></button></>}</div></div>)}</div> : <div className="empty-state"><h3>Você ainda não enviou convites</h3></div>}</div>
  </>
}
