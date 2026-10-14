import {useCallback,useEffect,useState} from 'react'
import {RefreshCw,RotateCcw} from 'lucide-react'
import {supabase} from '../../lib/supabase'

type Dashboard={summary:Record<string,number>;orders:any[];events:any[]}
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})

async function api(path:string,init?:RequestInit){
  const session=await supabase?.auth.getSession(),token=session?.data.session?.access_token
  if(!token)throw new Error('Sessão administrativa expirada.')
  const response=await fetch(path,{...init,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...init?.headers}}),data=await response.json()
  if(!response.ok)throw new Error(data.error||'Falha na integração.')
  return data
}

export function AdminPremiumFinance(){
  const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[search,setSearch]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{setData(await api(`/api/admin-asaas${search?`?search=${encodeURIComponent(search)}`:''}`))}catch(reason){setError(reason instanceof Error?reason.message:'Falha ao carregar.')}finally{setLoading(false)}},[search])
  useEffect(()=>{void load()},[load])
  async function retry(eventId:string){setLoading(true);try{await api('/api/admin-asaas',{method:'POST',body:JSON.stringify({eventId})});await load()}catch(reason){setError(reason instanceof Error?reason.message:'Falha ao reprocessar.');setLoading(false)}}
  const s=data?.summary||{}
  return <>
    <div className="topbar"><div><h1>Vendas e Perfil Premium</h1><div className="muted">Pedidos, confirmações financeiras e falhas da integração Asaas.</div></div><button className="btn btn-secondary" onClick={()=>void load()} disabled={loading}><RefreshCw/> Atualizar</button></div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="grid grid-4"><Metric label="Faturamento confirmado" value={money.format((s.grossCents||0)/100)}/><Metric label="Pagamentos pendentes" value={String(s.pending||0)}/><Metric label="Contratações ativas" value={String(s.activeContracts||0)}/><Metric label="Falhas de integração" value={String(s.failures||0)}/></div>
    <div className="grid grid-4" style={{marginTop:18}}><Metric label="Aguardando preenchimento" value={String(s.awaitingCompletion||0)}/><Metric label="Aguardando aprovação" value={String(s.awaitingApproval||0)}/><Metric label="Perfis publicados" value={String(s.published||0)}/><Metric label="Estornos/chargebacks" value={String(s.refunded||0)}/></div>
    <section className="card" style={{marginTop:18}}><div className="section-heading"><div><h2>Pedidos</h2><p className="muted">Preço e status provenientes do backend.</p></div><div className="row"><input aria-label="Buscar pedido ou checkout" placeholder="Nome, e-mail, pedido ou ID Asaas" value={search} onChange={e=>setSearch(e.target.value)}/><button className="btn btn-secondary" onClick={()=>void load()}>Buscar</button></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Data</th><th>Profissional</th><th>Pedido</th><th>Checkout Asaas</th><th>Valor</th><th>Status</th></tr></thead><tbody>{data?.orders?.map(order=><tr key={order.id}><td>{new Date(order.created_at).toLocaleString('pt-BR')}</td><td>{order.customer_name||'—'}<br/><small>{order.customer_email||''}</small></td><td><code>{order.id}</code></td><td><code>{order.asaas_checkout_id||'—'}</code></td><td>{money.format(order.amount_cents/100)}</td><td><span className="badge">{order.status}</span></td></tr>)}</tbody></table></div>
    </section>
    <section className="card" style={{marginTop:18}}><h2>Eventos com intervenção</h2>{data?.events?.length?<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Evento</th><th>Tipo</th><th>Tentativas</th><th>Erro</th><th>Ação</th></tr></thead><tbody>{data.events.map(event=><tr key={event.id}><td><code>{event.id}</code></td><td>{event.event_type}</td><td>{event.attempts}</td><td>{event.last_error||event.processing_status}</td><td><button className="btn btn-secondary btn-small" disabled={loading} onClick={()=>void retry(event.id)}><RotateCcw/> Reprocessar</button></td></tr>)}</tbody></table></div>:<p className="muted">Nenhum evento pendente ou com erro.</p>}</section>
  </>
}
function Metric({label,value}:{label:string;value:string}){return <div className="card admin-metric"><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
