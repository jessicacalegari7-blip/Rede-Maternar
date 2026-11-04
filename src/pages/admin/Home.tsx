import { useEffect, useState } from 'react'
import { Bell, Building2, CalendarDays, RefreshCw, UserCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPlatformSummary } from '../../lib/operations'
import { supabase } from '../../lib/supabase'

export function AdminHome(){
  const [data,setData]=useState<any>(null);const [error,setError]=useState('');const [diagnostic,setDiagnostic]=useState<any>(null)
  async function load(){try{setData(await getPlatformSummary())}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar painel.')}}
  async function runProductionDiagnostic(){
    setError('')
    try{
      const session=(await supabase?.auth.getSession()).data.session
      if(!session)throw new Error('Sessão administrativa indisponível.')
      const response=await fetch('/api/asaas-production-diagnostic',{headers:{Authorization:`Bearer ${session.access_token}`}})
      const body=await response.json()
      if(!response.ok)throw new Error(body.error||'Falha no diagnóstico.')
      setDiagnostic(body)
    }catch(reason){setError(reason instanceof Error?reason.message:'Falha no diagnóstico.')}
  }
  useEffect(()=>{void load()},[])
  const diagnosticMode=new URLSearchParams(location.search).get('asaasDiagnostic')==='1'
  return <><div className="topbar"><div><h1>Painel Administrativo</h1><div className="muted">Visão real da operação da MaterPlace.</div></div><div className="admin-notification-actions"><Link className={`btn admin-signup-alert${data?.pending_organizations?' has-pending':''}`} to="/admin/profissionais?status=pending"><Bell/><span>{data?.pending_organizations??0} cadastro(s) para aprovar</span></Link><button className="btn btn-secondary" onClick={()=>void load()}><RefreshCw/> Atualizar</button></div></div>{error&&<div className="alert alert-error">{error}</div>}{diagnosticMode&&<div className="card" style={{marginBottom:18}}><h2>Diagnóstico Asaas Production</h2><button className="btn btn-secondary" onClick={()=>void runProductionDiagnostic()}>Executar leitura única</button>{diagnostic&&<pre data-testid="asaas-production-diagnostic-result">{JSON.stringify(diagnostic,null,2)}</pre>}</div>}<div className="grid grid-4"><Card icon={Building2} label="Organizações" value={data?.organizations??0}/><Card icon={UserCheck} label="Planos ativos" value={data?.active_organizations??0}/><Card icon={Users} label="Pacientes" value={data?.patients??0}/><Card icon={CalendarDays} label="Agendamentos" value={data?.appointments??0}/></div><div className="grid grid-2" style={{marginTop:18}}><div className="card"><h2>Pendências</h2><div className="list-item"><span>Cadastros aguardando análise</span><strong>{data?.pending_organizations??0}</strong></div><div className="list-item"><span>Notificações de e-mail pendentes</span><strong>{data?.pending_notifications??0}</strong></div></div><div className="card"><h2>Prospecção</h2><div className="list-item"><span>Pré-cadastros reais</span><strong>{data?.prospects??0}</strong></div><p className="muted">Os telefones são acessíveis somente no backoffice.</p></div></div></>
}
function Card({icon:Icon,label,value}:{icon:any;label:string;value:number}){return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
