import { useEffect, useState } from 'react'
import { Building2, CalendarDays, RefreshCw, UserCheck, Users } from 'lucide-react'
import { getPlatformSummary } from '../../lib/operations'

export function AdminHome(){
  const [data,setData]=useState<any>(null);const [error,setError]=useState('')
  async function load(){try{setData(await getPlatformSummary())}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar painel.')}}
  useEffect(()=>{void load()},[])
  return <><div className="topbar"><div><h1>Painel Administrativo</h1><div className="muted">Visão real da operação da MaterPlace.</div></div><button className="btn btn-secondary" onClick={()=>void load()}><RefreshCw/> Atualizar</button></div>{error&&<div className="alert alert-error">{error}</div>}<div className="grid grid-4"><Card icon={Building2} label="Organizações" value={data?.organizations??0}/><Card icon={UserCheck} label="Planos ativos" value={data?.active_organizations??0}/><Card icon={Users} label="Pacientes" value={data?.patients??0}/><Card icon={CalendarDays} label="Agendamentos" value={data?.appointments??0}/></div><div className="grid grid-2" style={{marginTop:18}}><div className="card"><h2>Pendências</h2><div className="list-item"><span>Cadastros aguardando análise</span><strong>{data?.pending_organizations??0}</strong></div><div className="list-item"><span>Notificações de e-mail pendentes</span><strong>{data?.pending_notifications??0}</strong></div></div><div className="card"><h2>Prospecção</h2><div className="list-item"><span>Pré-cadastros reais</span><strong>{data?.prospects??0}</strong></div><p className="muted">Os telefones são acessíveis somente no backoffice.</p></div></div></>
}
function Card({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
