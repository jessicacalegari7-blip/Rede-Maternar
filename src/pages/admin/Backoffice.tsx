import { useEffect, useState } from 'react'
import { Building2, MessageCircle, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { getPlatformSummary, listAdminProspects } from '../../lib/operations'

export function AdminUsers(){return <RealBackoffice title="Cadastros e pré-cadastros"/>}
export function AdminOperations(){return <RealBackoffice title="Central do backoffice"/>}

function RealBackoffice({title}:{title:string}){
  const [summary,setSummary]=useState<any>(null)
  const [prospects,setProspects]=useState<any[]>([])
  const [error,setError]=useState('')
  const [search,setSearch]=useState('')
  async function load(){setError('');try{const [s,p]=await Promise.all([getPlatformSummary(),listAdminProspects()]);setSummary(s);setProspects(p)}catch(e){setError(e instanceof Error?e.message:'Falha ao carregar backoffice.')}}
  useEffect(()=>{void load()},[])
  const visible=prospects.filter(p=>[p.name,p.primary_specialty,p.city,p.whatsapp].join(' ').toLowerCase().includes(search.toLowerCase()))
  return <><div className="page-heading"><div><span className="badge">Administração geral</span><h1>{title}</h1><p className="muted">Dados reais de planos, organizações, pacientes e prospecção.</p></div><button className="btn btn-secondary" onClick={()=>void load()}><RefreshCw/> Atualizar</button></div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="grid grid-4"><Metric icon={Building2} label="Organizações" value={String(summary?.organizations??0)}/><Metric icon={ShieldCheck} label="Planos ativos" value={String(summary?.active_organizations??0)}/><Metric icon={Users} label="Profissionais" value={String(summary?.professionals??0)}/><Metric icon={MessageCircle} label="Pré-cadastros" value={String(summary?.prospects??0)}/></div>
    <section className="card backoffice-table-card"><div className="section-heading"><div><h2>Pré-cadastros pesquisados</h2><p className="muted">WhatsApp é privado e visível somente para a administração. Contato em massa permanece bloqueado até a API oficial e os modelos aprovados.</p></div><label className="search-field"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, cidade ou especialidade"/></label></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Especialidade</th><th>Cidade</th><th>WhatsApp privado</th><th>Revisão</th><th>Contato</th></tr></thead><tbody>{visible.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.primary_specialty}</td><td>{p.city} - {p.state_code}</td><td>{p.whatsapp||'Não informado'}</td><td><span className="badge">{p.review_status}</span></td><td><span className="badge">{p.outreach_status}</span></td></tr>)}</tbody></table></div>{!visible.length&&<div className="empty-state"><h3>Nenhum pré-cadastro real</h3><p className="muted">A pesquisa ainda não inseriu registros ou o filtro não encontrou resultados.</p></div>}</section>
  </>
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
