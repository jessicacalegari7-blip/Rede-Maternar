import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Landmark, Plus, RefreshCw, Wallet } from 'lucide-react'
import {
  closeCashSession, createFinancialEntry, getOpenCashSession, listFinancialEntries,
  openCashSession, updateFinancialEntryStatus, type FinancialEntryType, type RealCashSession, type RealFinancialEntry,
} from '../../lib/operations'

type FinanceView='overview'|'cashier'|'dre'|'payable'|'receivable'|'costs'|'taxes'|'payroll'|'invoices'
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const tabs:[FinanceView,string][]=[['overview','Visão geral'],['cashier','Caixa'],['dre','DRE'],['payable','Contas a pagar'],['receivable','Contas a receber'],['costs','Custos'],['taxes','Impostos'],['payroll','Folha salarial'],['invoices','Notas fiscais']]

export function FinanceSuite({initial='overview'}:{initial?:FinanceView}){
  const [view,setView]=useState<FinanceView>(initial)
  const [entries,setEntries]=useState<RealFinancialEntry[]>([])
  const [cash,setCash]=useState<RealCashSession|null>(null)
  const [show,setShow]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [dateFrom,setDateFrom]=useState('')
  const [dateTo,setDateTo]=useState('')
  const [appliedFrom,setAppliedFrom]=useState('')
  const [appliedTo,setAppliedTo]=useState('')
  async function load(){setError('');try{const [e,c]=await Promise.all([listFinancialEntries(),getOpenCashSession()]);setEntries(e);setCash(c)}catch(err){setError(err instanceof Error?err.message:'Falha ao carregar financeiro.')}}
  useEffect(()=>{void load()},[])
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{await createFinancialEntry({
    type:String(f.get('type')) as FinancialEntryType,category:String(f.get('category')),description:String(f.get('description')),
    amount:Number(String(f.get('amount')).replace(',','.')),dueDate:String(f.get('dueDate')||''),status:String(f.get('status')) as RealFinancialEntry['status'],
    paymentMethod:String(f.get('paymentMethod')||''),recurring:f.get('recurring')==='on',
  });setShow(false);setNotice('Lançamento salvo no banco.');await load()}catch(err){setError(err instanceof Error?err.message:'Falha ao salvar lançamento.')}}
  const dateFiltered=entries.filter(e=>{const date=(e.paid_at||e.due_date||e.created_at).slice(0,10);return(!appliedFrom||date>=appliedFrom)&&(!appliedTo||date<=appliedTo)})
  const filtered=dateFiltered.filter(e=>view==='payable'?['payable','expense'].includes(e.type):view==='receivable'?['receivable','income'].includes(e.type):view==='costs'?e.type==='expense':view==='taxes'?e.type==='tax':view==='payroll'?e.type==='payroll':true)
  const totals=useMemo(()=>{const paid=dateFiltered.filter(e=>e.status==='paid');const income=paid.filter(e=>['income','receivable'].includes(e.type)).reduce((s,e)=>s+e.amount_cents,0);const expense=paid.filter(e=>['expense','payable','tax','payroll'].includes(e.type)).reduce((s,e)=>s+e.amount_cents,0);const pending=dateFiltered.filter(e=>e.status==='pending'&&['receivable','income'].includes(e.type)).reduce((s,e)=>s+e.amount_cents,0);return{income,expense,pending,result:income-expense}},[dateFiltered])
  return <><div className="page-heading"><div><span className="badge">ERP financeiro real</span><h1>Gestão financeira</h1><p className="muted">Todos os lançamentos abaixo pertencem à organização conectada.</p></div><div className="heading-actions"><button className="icon-btn" onClick={()=>void load()}><RefreshCw/></button><button className="btn btn-primary" onClick={()=>setShow(true)}><Plus/> Novo lançamento</button></div></div>
    {error&&<div className="alert alert-error">{error}</div>}{notice&&<div className="success-banner">{notice}</div>}
    <div className="finance-tabs">{tabs.map(([id,label])=><button className={view===id?'active':''} onClick={()=>setView(id)} key={id}>{label}</button>)}</div>
    <div className="card finance-date-filter"><label>Data inicial<input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label><label>Data final<input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label><button className="btn btn-primary" onClick={()=>{setAppliedFrom(dateFrom);setAppliedTo(dateTo)}}>Buscar</button><button className="btn btn-secondary" onClick={()=>{setDateFrom('');setDateTo('');setAppliedFrom('');setAppliedTo('')}}>Limpar período</button></div>
    {view==='overview'&&<><div className="grid grid-4"><Metric icon={CircleDollarSign} label="Receitas pagas" value={money.format(totals.income/100)}/><Metric icon={ArrowDownLeft} label="Despesas pagas" value={money.format(totals.expense/100)}/><Metric icon={Wallet} label="Resultado" value={money.format(totals.result/100)}/><Metric icon={ArrowUpRight} label="A receber" value={money.format(totals.pending/100)}/></div><Entries rows={dateFiltered} reload={load}/></>}
    {view==='cashier'&&<Cashier cash={cash} totals={totals} reload={load} onNotice={setNotice}/>}
    {view==='dre'&&<Dre entries={dateFiltered}/>}
    {['payable','receivable','costs','taxes','payroll'].includes(view)&&<Entries rows={filtered} reload={load}/>}
    {view==='invoices'&&<div className="card empty-state"><h2>Emissão de NFS-e</h2><p className="muted">O módulo está reservado, mas a emissão real depende da contratação de um provedor fiscal e suas credenciais. Nenhuma nota fictícia é exibida.</p></div>}
    {show&&<div className="modal-backdrop"><form className="modal-card customer-form" onSubmit={submit}><div className="modal-head"><div><h2>Novo lançamento</h2><p className="muted">Será salvo imediatamente no Supabase.</p></div><button type="button" className="icon-btn" onClick={()=>setShow(false)}>×</button></div><div className="form-grid"><label className="field"><span>Tipo</span><select name="type"><option value="receivable">Conta a receber</option><option value="payable">Conta a pagar</option><option value="income">Receita</option><option value="expense">Despesa/custo</option><option value="tax">Imposto</option><option value="payroll">Folha salarial</option></select></label><label className="field"><span>Status</span><select name="status"><option value="pending">Pendente</option><option value="paid">Pago/recebido</option><option value="overdue">Atrasado</option><option value="cancelled">Cancelado</option></select></label><label className="field"><span>Categoria</span><input name="category" required/></label><label className="field"><span>Descrição</span><input name="description" required/></label><label className="field"><span>Valor (R$)</span><input name="amount" inputMode="decimal" required/></label><label className="field"><span>Vencimento</span><input name="dueDate" type="date"/></label><label className="field"><span>Forma de pagamento</span><input name="paymentMethod"/></label><label className="check-row"><input name="recurring" type="checkbox"/><span>Lançamento recorrente</span></label></div><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShow(false)}>Cancelar</button><button className="btn btn-primary">Salvar</button></div></form></div>}
  </>
}

function Entries({rows,reload}:{rows:RealFinancialEntry[];reload:()=>Promise<void>}){
  return <section className="card finance-table-card"><div className="section-heading"><div><h2>Lançamentos</h2><p className="muted">{rows.length} registros reais</p></div></div><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{e.description}</td><td>{e.category}</td><td>{e.due_date?new Date(`${e.due_date}T12:00:00`).toLocaleDateString('pt-BR'):'—'}</td><td><strong>{money.format(e.amount_cents/100)}</strong></td><td><span className="badge">{e.status}</span></td><td>{e.status!=='paid'&&<button className="btn btn-secondary btn-small" onClick={async()=>{await updateFinancialEntryStatus(e.id,'paid');await reload()}}>Marcar pago</button>}</td></tr>)}</tbody></table></div>{!rows.length&&<div className="empty-state"><p className="muted">Nenhum lançamento real nesta categoria.</p></div>}</section>
}

function Cashier({cash,totals,reload,onNotice}:{cash:RealCashSession|null;totals:{income:number;expense:number;result:number;pending:number};reload:()=>Promise<void>;onNotice:(x:string)=>void}){
  async function open(){const value=window.prompt('Saldo inicial do caixa','0');if(value!==null){await openCashSession(Number(value.replace(',','.')));onNotice('Caixa aberto e salvo.');await reload()}}
  async function close(){if(!cash)return;const value=window.prompt('Saldo final do caixa',String((cash.opening_balance_cents+totals.result)/100));if(value!==null){await closeCashSession(cash.id,Number(value.replace(',','.')));onNotice('Caixa fechado e salvo.');await reload()}}
  return <><div className={`cashier-status card ${cash?'is-open':''}`}><div><span className="badge">{cash?'Caixa aberto':'Caixa fechado'}</span><h2>{cash?`Aberto em ${new Date(cash.opened_at).toLocaleString('pt-BR')}`:'Abra o caixa para registrar o movimento do dia'}</h2><p className="muted">{cash?`Saldo inicial ${money.format(cash.opening_balance_cents/100)}`:'Informe o saldo inicial.'}</p></div>{cash?<button className="btn btn-secondary" onClick={()=>void close()}>Fechar caixa</button>:<button className="btn btn-primary" onClick={()=>void open()}><Landmark/> Abrir caixa</button>}</div>{cash&&<div className="grid grid-3"><Metric icon={Wallet} label="Saldo calculado" value={money.format((cash.opening_balance_cents+totals.result)/100)}/><Metric icon={CircleDollarSign} label="Entradas" value={money.format(totals.income/100)}/><Metric icon={ArrowDownLeft} label="Saídas" value={money.format(totals.expense/100)}/></div>}</>
}

function Dre({entries}:{entries:RealFinancialEntry[]}){
  const [period,setPeriod]=useState<'day'|'month'|'year'>('month')
  const now=new Date();const inPeriod=(e:RealFinancialEntry)=>{const raw=e.due_date?`${e.due_date}T12:00:00`:e.created_at;const d=new Date(raw);return period==='day'?d.toDateString()===now.toDateString():period==='month'?d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear():d.getFullYear()===now.getFullYear()}
  const competence=entries.filter(e=>e.status!=='cancelled'&&inPeriod(e));const realized=competence.filter(e=>e.status==='paid')
  const sum=(rows:RealFinancialEntry[],types:string[])=>rows.filter(e=>types.includes(e.type)).reduce((s,e)=>s+e.amount_cents,0)
  const revenue=sum(competence,['income','receivable']);const expense=sum(competence,['expense','payable','tax','payroll']);const realizedRevenue=sum(realized,['income','receivable']);const realizedExpense=sum(realized,['expense','payable','tax','payroll'])
  return <><div className="dre-toolbar card"><div><h2>DRE gerencial</h2><p className="muted">Regime de competência: considera lançamentos do período, pagos ou pendentes. O realizado mostra somente pagamentos confirmados.</p></div><div className="tabs compact-tabs"><button className={period==='day'?'active':''} onClick={()=>setPeriod('day')}>Diário</button><button className={period==='month'?'active':''} onClick={()=>setPeriod('month')}>Mensal</button><button className={period==='year'?'active':''} onClick={()=>setPeriod('year')}>Anual</button></div></div><div className="grid grid-3"><Metric icon={CircleDollarSign} label="Receita (competência)" value={money.format(revenue/100)}/><Metric icon={ArrowDownLeft} label="Custos e despesas" value={money.format(expense/100)}/><Metric icon={Wallet} label="Resultado líquido" value={money.format((revenue-expense)/100)}/></div><div className="grid grid-3" style={{marginTop:18}}><Metric icon={CircleDollarSign} label="Receita realizada" value={money.format(realizedRevenue/100)}/><Metric icon={ArrowDownLeft} label="Despesas realizadas" value={money.format(realizedExpense/100)}/><Metric icon={Wallet} label="Caixa realizado" value={money.format((realizedRevenue-realizedExpense)/100)}/></div></>
}

function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
