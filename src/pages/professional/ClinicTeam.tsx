import { useEffect, useState } from 'react'
import { CalendarDays, Mail, Plus, ShieldCheck, Users, X } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { createClinicTeamMember, listActiveSpecialties, listClinicTeam, type RealTeamMember } from '../../lib/operations'
import { isClinicPlan } from '../../lib/plans'

export function ClinicTeam() {
  const {user}=useAuth(); const [members,setMembers]=useState<RealTeamMember[]>([]); const [specialties,setSpecialties]=useState<string[]>([])
  const [open,setOpen]=useState(false); const [error,setError]=useState(''); const [notice,setNotice]=useState('')
  async function load(){setError('');try{const [team,options]=await Promise.all([listClinicTeam(),listActiveSpecialties()]);setMembers(team);setSpecialties(options.map(x=>x.name))}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar equipe.')}}
  useEffect(()=>{void load()},[])
  if(!isClinicPlan(user?.plan))return <Navigate to="/profissional" replace/>
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);try{await createClinicTeamMember({name:String(data.get('name')),email:String(data.get('email')),specialty:String(data.get('specialty')),registration:String(data.get('registration')||'')});setOpen(false);setNotice('Profissional cadastrada no Supabase.');await load()}catch(e){setError(e instanceof Error?e.message:'Falha ao cadastrar profissional.')}}
  const specialty=(member:RealTeamMember)=>{const relation=member.professional_specialties?.[0]?.specialties;return (Array.isArray(relation)?relation[0]?.name:relation?.name)||'Não informada'}
  return <div><div className="page-heading"><div><span className="badge">Gestão da clínica</span><h1>Equipe de profissionais</h1><p className="muted">Somente profissionais gravados no banco são exibidos.</p></div><button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus/>Adicionar profissional</button></div>
    {error&&<div className="alert alert-error">{error}</div>}{notice&&<div className="success-banner">{notice}</div>}
    <div className="grid grid-3"><div className="card team-metric"><Users/><span><strong>{members.length}</strong><small>Profissionais cadastrados</small></span></div><div className="card team-metric"><CalendarDays/><span><strong>{members.length}</strong><small>Agendas individuais</small></span></div><div className="card team-metric"><ShieldCheck/><span><strong>Supabase</strong><small>Dados reais da clínica</small></span></div></div>
    <section className="card backoffice-table-card"><div className="table-wrap"><table><thead><tr><th>Profissional</th><th>Especialidade</th><th>Registro</th><th>Situação</th></tr></thead><tbody>{members.map(member=><tr key={member.id}><td><strong>{member.full_name}</strong><small className="table-subtitle">{member.email||'Sem e-mail'}</small></td><td>{specialty(member)}</td><td>{member.professional_registration||'Não informado'}</td><td><span className="badge">Cadastrada</span></td></tr>)}</tbody></table></div>{!members.length&&<div className="empty-state"><h3>Nenhuma profissional cadastrada</h3></div>}</section>
    {open&&<div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><div className="modal-head"><div><h2>Adicionar profissional</h2><p className="muted">O perfil ficará privado até a aprovação/publicação.</p></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)}><X/></button></div><div className="form-grid"><label className="field field-span-2"><span>Nome completo</span><input name="name" required/></label><label className="field"><span>E-mail</span><input name="email" type="email" required/></label><label className="field"><span>Especialidade</span><select name="specialty" required>{specialties.map(x=><option key={x}>{x}</option>)}</select></label><label className="field"><span>Registro profissional</span><input name="registration"/></label></div><div className="integration-policy"><Mail/><div><strong>Cadastro real</strong><span>O registro será vinculado à clínica no Supabase.</span></div></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn btn-primary">Cadastrar</button></div></form></div>}
  </div>
}
