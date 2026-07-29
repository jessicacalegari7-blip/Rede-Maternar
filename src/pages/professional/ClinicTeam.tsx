import { useState } from 'react'
import { CalendarDays, Mail, Plus, ShieldCheck, UserCog, Users, X } from 'lucide-react'

type TeamMember = { name:string; specialty:string; role:string; email:string; agenda:string; status:string }

const initialTeam: TeamMember[] = [
  { name:'Dra. Marina Lopes', specialty:'Consultoria em amamentação', role:'Administradora', email:'marina@clinicacuidar.com.br', agenda:'Agenda própria', status:'Ativa' },
  { name:'Dra. Camila Rocha', specialty:'Pediatria', role:'Profissional', email:'camila@clinicacuidar.com.br', agenda:'Agenda própria', status:'Ativa' },
  { name:'Fernanda Alves', specialty:'Psicologia perinatal', role:'Profissional', email:'fernanda@clinicacuidar.com.br', agenda:'Agenda própria', status:'Convite enviado' },
]

export function ClinicTeam() {
  const [members,setMembers] = useState(initialTeam)
  const [open,setOpen] = useState(false)
  function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setMembers(current => [...current, { name:String(data.get('name')), specialty:String(data.get('specialty')), role:String(data.get('role')), email:String(data.get('email')), agenda:'Agenda própria', status:'Convite enviado' }])
    setOpen(false)
  }
  return <div>
    <div className="page-heading"><div><span className="badge">Gestão da clínica</span><h1>Equipe de profissionais</h1><p className="muted">Cadastre profissionais, organize agendas individuais e controle o acesso de cada pessoa.</p></div><button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={17}/> Adicionar profissional</button></div>
    <div className="grid grid-3">
      <div className="card team-metric"><Users/><span><strong>{members.length}</strong><small>Profissionais cadastrados</small></span></div>
      <div className="card team-metric"><CalendarDays/><span><strong>{members.length}</strong><small>Agendas individuais</small></span></div>
      <div className="card team-metric"><ShieldCheck/><span><strong>Por função</strong><small>Permissões de acesso</small></span></div>
    </div>
    <section className="card backoffice-table-card clinic-team-card">
      <div className="section-heading"><div><h2>Profissionais vinculados</h2><p className="muted">Cada profissional utiliza seu próprio acesso e visualiza somente o que sua função permite.</p></div><span className="badge">Plano Gestão Completa</span></div>
      <div className="table-wrap"><table><thead><tr><th>Profissional</th><th>Especialidade</th><th>Função</th><th>Agenda</th><th>Status</th><th>Acesso</th></tr></thead><tbody>
        {members.map(member=><tr key={member.email}><td><strong>{member.name}</strong><small className="table-subtitle">{member.email}</small></td><td>{member.specialty}</td><td>{member.role}</td><td>{member.agenda}</td><td><span className="badge">{member.status}</span></td><td><button className="icon-btn" title="Gerenciar acesso"><UserCog size={18}/></button></td></tr>)}
      </tbody></table></div>
    </section>
    {open&&<div className="modal-backdrop"><form className="modal-card" onSubmit={submit}>
      <div className="modal-head"><div><span className="badge">Novo acesso</span><h2>Adicionar profissional</h2><p className="muted">A pessoa receberá um convite por e-mail para criar a própria senha.</p></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)}><X/></button></div>
      <div className="form-grid">
        <label className="field field-span-2"><span>Nome completo</span><input name="name" required/></label>
        <label className="field"><span>E-mail profissional</span><input name="email" type="email" required/></label>
        <label className="field"><span>Especialidade</span><input name="specialty" placeholder="Ex.: Pediatria" required/></label>
        <label className="field"><span>Função e permissões</span><select name="role"><option>Profissional</option><option>Administradora</option><option>Recepção</option><option>Financeiro</option></select></label>
        <label className="field"><span>Registro profissional</span><input placeholder="Conselho e número"/></label>
      </div>
      <div className="integration-policy"><Mail/><div><strong>Convite individual e seguro</strong><span>O acesso será vinculado à clínica, com agenda, atendimentos e permissões separados.</span></div></div>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary">Cadastrar e enviar convite</button></div>
    </form></div>}
  </div>
}
