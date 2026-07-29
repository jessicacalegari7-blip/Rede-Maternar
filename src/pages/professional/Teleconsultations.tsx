import { useState } from 'react'
import {
  CalendarClock, CheckCircle2, Clock3, Copy, CreditCard, MessageCircle,
  Moon, Plus, Settings, Video, VideoOff, Wallet,
} from 'lucide-react'

const appointments = [
  {patient:'Camila Ribeiro',time:'Hoje, 23:30',service:'Consulta online',payment:'Pago',status:'Sala liberada'},
  {patient:'Juliana Martins',time:'Amanhã, 00:30',service:'Orientação pós-parto',payment:'Aguardando',status:'Confirmada'},
  {patient:'Beatriz Lopes',time:'Amanhã, 02:00',service:'Consulta de amamentação',payment:'Pago',status:'Confirmada'},
]
const nightSlots = ['22:00','22:45','23:30','00:30','01:15','02:00','03:00']

export function Teleconsultations(){
  const [message,setMessage]=useState('')
  const [roomOpen,setRoomOpen]=useState(false)
  function demo(text:string){setMessage(text);setTimeout(()=>setMessage(''),2800)}
  return <><div className="page-heading"><div><span className="badge">Atendimento online</span><h1>Teleconsultas</h1><p className="muted">Agenda, pagamento e sala de vídeo integrados em uma única jornada.</p></div><button className="btn btn-primary"><Plus size={17}/> Disponibilizar horário</button></div>
    {message&&<div className="success-banner"><CheckCircle2/>{message}</div>}
    <div className="grid grid-4"><Metric icon={Video} label="Teleconsultas no mês" value="26"/><Metric icon={Moon} label="Horários noturnos" value="7 abertos"/><Metric icon={CreditCard} label="Pagamentos confirmados" value="92%"/><Metric icon={Clock3} label="Próxima consulta" value="23:30"/></div>
    <div className="grid tele-grid" style={{marginTop:18}}><section className="card tele-schedule"><div className="section-heading"><div><h2>Agenda de teleconsultas</h2><p className="muted">Atendimentos online disponíveis inclusive na madrugada.</p></div><button className="icon-btn"><Settings/></button></div>{appointments.map((item,i)=><article className="tele-appointment" key={item.patient}><div className="tele-date"><Video/><span>{item.time}</span></div><div><strong>{item.patient}</strong><small>{item.service}</small></div><span className={`badge ${item.payment==='Pago'?'paid-badge':''}`}>{item.payment}</span><div className="tele-actions">{item.payment==='Pago'?<button className="btn btn-primary btn-small" onClick={()=>setRoomOpen(true)}><Video/> Entrar na sala</button>:<button className="btn btn-secondary btn-small" onClick={()=>demo('Link de pagamento preparado para envio no WhatsApp.')}><Wallet/> Cobrar</button>}<button className="icon-btn" onClick={()=>demo(`Link da teleconsulta de ${item.patient} copiado.`)}><Copy/></button></div></article>)}</section>
      <aside className="card night-availability"><div className="row"><Moon/><div><h2>Plantão e madrugada</h2><p className="muted">Libere horários específicos sem alterar sua agenda regular.</p></div></div><div className="night-date"><CalendarClock/><span><strong>Sábado para domingo</strong><small>01–02 de agosto</small></span></div><div className="night-slots">{nightSlots.map((slot,i)=><button className={i===3||i===5?'active':''} key={slot}>{slot}</button>)}</div><label className="switch-row"><input type="checkbox" defaultChecked/><span>Exigir pagamento para liberar a sala</span></label><label className="switch-row"><input type="checkbox" defaultChecked/><span>Enviar lembrete 30 minutos antes</span></label><button className="btn btn-primary full" onClick={()=>demo('Disponibilidade noturna atualizada.')}>Salvar disponibilidade</button></aside></div>
    <section className="card tele-rules"><h2>Fluxo automático da consulta online</h2><div>{[['1',CreditCard,'Pagamento','A cliente paga pelo link seguro.'],['2',CalendarClock,'Confirmação','O horário é confirmado na agenda.'],['3',MessageCircle,'Lembrete','WhatsApp recebe o acesso e o lembrete.'],['4',Video,'Sala privada','O botão é liberado próximo do horário.']].map(([n,Icon,title,text])=><article key={String(n)}><span>{String(n)}</span><Icon/><div><strong>{String(title)}</strong><small>{String(text)}</small></div></article>)}</div></section>
    {roomOpen&&<div className="modal-backdrop"><div className="modal-card video-room"><div className="video-stage"><div className="video-participant">CR</div><span>Camila ainda não entrou</span></div><div className="video-controls"><button><Video/></button><button><MessageCircle/></button><button className="end-call" onClick={()=>setRoomOpen(false)}><VideoOff/></button></div><p>Ambiente demonstrativo. A videoconferência real será conectada a um provedor seguro.</p></div></div>}
  </>
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
