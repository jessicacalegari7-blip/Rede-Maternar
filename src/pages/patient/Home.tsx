import { CalendarDays, MessageCircle, CreditCard, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { getPatientProfessional } from '../../lib/invitations'

export function PatientHome(){
  const { user } = useAuth(); const relationship = user ? getPatientProfessional(user.id) : null
  const professional = relationship?.professional
  const firstName = user?.name.split(' ')[0] || 'Paciente'
  return <><div className="topbar"><div><h1>Olá, {firstName} 🌷</h1><div className="muted">Seu espaço de cuidado e acompanhamento.</div></div></div>
  {professional ? <div className="card" style={{background:'var(--wine)',color:'white'}}><div className="row"><div className="avatar" style={{background:'white'}}>{professional.name.split(' ').slice(0,2).map(p=>p[0]).join('')}</div><div><div style={{opacity:.8}}>Você está sendo acompanhada por</div><h2 style={{margin:'4px 0'}}>{professional.name}</h2><div>{professional.specialty || 'Profissional da Rede Maternar'}</div></div></div></div> : <div className="card empty-link-card"><UserRound/><div><h2>Seu vínculo profissional será exibido aqui</h2><p className="muted">Este acesso ainda não possui uma profissional vinculada.</p></div></div>}
  <div className="grid grid-3" style={{marginTop:18}}>{[[MessageCircle,'Conversar','/paciente/conversas'],[CalendarDays,'Agendar','/paciente/agendamentos'],[CreditCard,'Pagamentos','/paciente/pagamentos']].map(([Icon,t,to])=><Link className="card quick-link" to={String(to)} key={String(t)}><Icon/><h3>{String(t)}</h3></Link>)}</div>
  <div className="grid grid-2" style={{marginTop:18}}><div className="card"><span className="badge">Próxima consulta</span><h2>Nenhum atendimento agendado</h2><p className="muted">Quando você fizer um agendamento, os detalhes aparecerão aqui.</p><Link to="/paciente/agendamentos" className="btn btn-secondary">Ver agenda</Link></div><div className="card"><span className="badge">Mensagem recente</span><h2>{professional?.name || 'Rede Maternar'}</h2><p>{professional ? 'Seu canal de conversa exclusivo já está preparado.' : 'Aceite um convite profissional para iniciar seu acompanhamento.'}</p><Link to="/paciente/conversas" className="btn btn-primary">Abrir conversas</Link></div></div></>}
