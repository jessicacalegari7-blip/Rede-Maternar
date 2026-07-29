import { useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, BadgeDollarSign, Building2, CalendarDays, CheckCircle2,
  CircleDollarSign, Copy, FileCheck2, FileText, Landmark, Link2, MessageCircle, Plus, ReceiptText, Users, Wallet,
} from 'lucide-react'

type FinanceView = 'overview'|'cashier'|'dre'|'payable'|'receivable'|'costs'|'taxes'|'payroll'|'invoices'
const money = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})

const payable = [
  ['Aluguel do consultório','Estrutura','05/08/2026',3200,'Agendado'],
  ['Contabilidade','Administrativo','08/08/2026',680,'Pendente'],
  ['Software e prontuário externo','Tecnologia','10/08/2026',429.90,'Pendente'],
  ['Energia elétrica','Utilidades','12/08/2026',386.42,'Pendente'],
  ['Materiais descartáveis','Insumos','14/08/2026',742.80,'Pendente'],
]
const receivable = [
  ['Camila Ribeiro','Consulta inicial','02/08/2026',220,'Recebido'],
  ['Juliana Martins','Acompanhamento','05/08/2026',380,'A receber'],
  ['Beatriz Lopes','Consulta online','07/08/2026',180,'A receber'],
  ['Mariana Alves','Pacote de retornos','10/08/2026',450,'Atrasado'],
]
const fixedCosts = [
  ['Aluguel e condomínio',3200],['Salários administrativos',4200],['Pró-labore',3500],
  ['Contabilidade',680],['Sistemas e licenças',429.90],['Internet e telefonia',289.90],
  ['Seguros',210],['Limpeza contratada',650],['Marketing recorrente',900],
  ['Locação de equipamentos',780],['Energia, água e gás',620],
]
const variableCosts = [
  ['Materiais clínicos e descartáveis',742.80],['Taxas de cartão e gateway',386.20],
  ['Impostos sobre faturamento',1123.20],['Serviços terceirizados',680],
  ['Lavanderia e esterilização',245],['Manutenção de equipamentos',320],
  ['Transporte e entregas',168.50],['Campanhas de mídia paga',450],
  ['Cursos e treinamentos',290],['Materiais de escritório e impressão',185.40],
  ['Café, água e itens de recepção',142.70],['Coleta de resíduos',190],
]
const employees = [
  ['Fernanda Lima','Recepcionista',2400,540,720,2220],
  ['Aline Costa','Assistente administrativa',2800,630,840,2590],
  ['Rafael Souza','Auxiliar de serviços',1900,427.50,570,1757.50],
]
const taxes = [
  ['DAS — Simples Nacional','07/08/2026',1123.20,'A calcular'],
  ['ISS municipal','10/08/2026',420,'Provisionado'],
  ['INSS sobre folha','20/08/2026',1180,'Provisionado'],
  ['FGTS','20/08/2026',568,'Provisionado'],
  ['IRRF retido','20/08/2026',184.20,'Provisionado'],
]
const invoices = [
  ['NFS-e 000184','Camila Ribeiro','Consulta inicial',220,'Emitida'],
  ['NFS-e 000183','Laura Mendes','Retorno',150,'Emitida'],
  ['Rascunho','Juliana Martins','Acompanhamento',380,'Pendente'],
  ['NFS-e 000182','Beatriz Lopes','Consulta online',180,'Cancelada'],
]

const tabs: [FinanceView,string][] = [
  ['overview','Visão geral'],['cashier','Caixa'],['dre','DRE'],['payable','Contas a pagar'],['receivable','Contas a receber'],
  ['costs','Custos'],['taxes','Impostos'],['payroll','Folha salarial'],['invoices','Notas fiscais'],
]

export function FinanceSuite({ initial='overview' }:{initial?:FinanceView}) {
  const [view,setView]=useState<FinanceView>(initial)
  const [paymentLink,setPaymentLink]=useState(false)
  const [generated,setGenerated]=useState('')
  const [cashOpen,setCashOpen]=useState(false)
  function generate(){setGenerated('https://pagar.redematernar.com/cob/demo-48291')}
  return <><div className="page-heading"><div><span className="badge">ERP financeiro</span><h1>Gestão financeira</h1><p className="muted">Controle completo da operação financeira da profissional ou clínica.</p></div><div className="heading-actions"><button className="btn btn-secondary" onClick={()=>setPaymentLink(true)}><Link2 size={17}/> Gerar link de pagamento</button><button className="btn btn-primary"><Plus size={17}/> Novo lançamento</button></div></div>
    <div className="finance-tabs">{tabs.map(([id,label])=><button className={view===id?'active':''} onClick={()=>setView(id)} key={id}>{label}</button>)}</div>
    {view==='overview'&&<Overview setView={setView}/>}
    {view==='cashier'&&<Cashier open={cashOpen} onOpen={()=>setCashOpen(true)}/>}
    {view==='dre'&&<Dre/>}
    {view==='payable'&&<Payable/>}
    {view==='receivable'&&<Receivable/>}
    {view==='costs'&&<Costs/>}
    {view==='taxes'&&<Taxes/>}
    {view==='payroll'&&<Payroll/>}
    {view==='invoices'&&<Invoices/>}
    {paymentLink&&<div className="modal-backdrop"><div className="modal-card payment-link-modal"><div className="modal-head"><div><span className="badge">Cobrança online</span><h2>Gerar link de pagamento</h2><p className="muted">Crie uma cobrança para enviar à cliente pelo WhatsApp.</p></div><button className="icon-btn" onClick={()=>{setPaymentLink(false);setGenerated('')}}>×</button></div>{!generated?<><div className="form-grid"><label className="field"><span>Cliente</span><select><option>Juliana Martins</option><option>Beatriz Lopes</option><option>Mariana Alves</option></select></label><label className="field"><span>Serviço</span><select><option>Consulta online</option><option>Consulta inicial</option><option>Acompanhamento pós-parto</option></select></label><label className="field"><span>Valor</span><input defaultValue="220,00"/></label><label className="field"><span>Vencimento</span><input type="date" defaultValue="2026-08-05"/></label><label className="field field-span-2"><span>Formas aceitas</span><div className="payment-options"><label><input type="checkbox" defaultChecked/> Pix</label><label><input type="checkbox" defaultChecked/> Cartão</label><label><input type="checkbox"/> Boleto</label></div></label></div><label className="check-row"><input type="checkbox" defaultChecked/><span>Confirmar automaticamente a agenda após o pagamento.</span></label><button className="btn btn-primary full" onClick={generate}>Gerar link seguro</button></>:<div className="generated-link"><CheckCircle2/><h3>Link gerado com sucesso</h3><p>A cobrança foi registrada em Contas a Receber.</p><code>{generated}</code><div className="grid grid-2"><button className="btn btn-secondary" onClick={()=>navigator.clipboard?.writeText(generated)}><Copy/> Copiar link</button><button className="btn whatsapp-btn" onClick={()=>alert('Na versão real, o WhatsApp da cliente será aberto com o link e uma mensagem personalizada.')}><MessageCircle/> Enviar no WhatsApp</button></div><small>Ambiente demonstrativo: nenhum pagamento real será processado.</small></div>}</div></div>}
  </>
}

function Cashier({open,onOpen}:{open:boolean;onOpen:()=>void}) {
  return <><div className={`cashier-status card ${open?'is-open':''}`}><div><span className="badge">{open?'Caixa aberto':'Caixa fechado'}</span><h2>{open?'Caixa de 29/07/2026':'Abra o caixa para iniciar o movimento do dia'}</h2><p className="muted">{open?'Aberto às 07:48 por Marina Lopes · saldo inicial R$ 300,00':'Informe o saldo inicial antes de registrar recebimentos presenciais.'}</p></div>{!open&&<button className="btn btn-primary" onClick={onOpen}>Abrir caixa</button>}</div>
    {open&&<><div className="grid grid-4"><Metric icon={Wallet} label="Saldo atual" value="R$ 1.286"/><Metric icon={CircleDollarSign} label="Entradas" value="R$ 1.140"/><Metric icon={ArrowDownLeft} label="Saídas" value="R$ 154"/><Metric icon={ReceiptText} label="Atendimentos pagos" value="5"/></div><FinanceTable title="Movimento do caixa" subtitle="Todo atendimento marcado como pago entra automaticamente no faturamento diário e mensal." rows={[[ '08:54','Camila Ribeiro','Pix',220,'Atendimento pago'],['10:12','Juliana Martins','Dinheiro',150,'Atendimento pago'],['11:35','Material clínico','Dinheiro',54,'Saída'],['14:02','Beatriz Lopes','Cartão',380,'Atendimento pago']]} headers={['Hora','Descrição','Forma','Valor','Origem']}/></>}
  </>
}

function Dre(){
  const [period,setPeriod]=useState<'day'|'month'|'year'>('month')
  const data={day:['R$ 1.140','R$ 154','R$ 986','86,5%'],month:['R$ 18.720','R$ 11.846','R$ 6.874','36,7%'],year:['R$ 184.360','R$ 119.420','R$ 64.940','35,2%']}[period]
  const label={day:'29 de julho',month:'Julho de 2026',year:'Ano de 2026'}[period]
  return <><div className="dre-toolbar card"><div><h2>Demonstração do Resultado (DRE)</h2><p className="muted">Regime gerencial demonstrativo consolidado por período.</p></div><div className="tabs compact-tabs"><button className={period==='day'?'active':''} onClick={()=>setPeriod('day')}>Diário</button><button className={period==='month'?'active':''} onClick={()=>setPeriod('month')}>Mensal</button><button className={period==='year'?'active':''} onClick={()=>setPeriod('year')}>Anual</button></div></div><div className="grid grid-4"><Metric icon={CircleDollarSign} label={`Receita · ${label}`} value={data[0]}/><Metric icon={ArrowDownLeft} label="Custos e despesas" value={data[1]}/><Metric icon={Wallet} label="Resultado líquido" value={data[2]}/><Metric icon={BadgeDollarSign} label="Margem líquida" value={data[3]}/></div><section className="card dre-card"><h2>Estrutura do resultado</h2>{[['Receita bruta',data[0]],['(-) Taxas e impostos','R$ 1.684'],['= Receita líquida','R$ 17.036'],['(-) Custos variáveis','R$ 3.214'],['(-) Custos fixos','R$ 6.948'],['= Resultado líquido',data[2]]].map(([name,value],i)=><div className={i===5?'dre-total':''} key={name}><span>{name}</span><strong>{value}</strong></div>)}</section></>
}

function Overview({setView}:{setView:(v:FinanceView)=>void}) {
  return <><div className="grid grid-4"><Metric icon={CircleDollarSign} label="Receitas no mês" value="R$ 18.720"/><Metric icon={ArrowDownLeft} label="Despesas no mês" value="R$ 11.846"/><Metric icon={Wallet} label="Resultado projetado" value="R$ 6.874"/><Metric icon={CalendarDays} label="A receber" value="R$ 4.280"/></div>
    <div className="grid grid-2" style={{marginTop:18}}><section className="card"><div className="section-heading"><h2>Fluxo de caixa</h2><span className="badge">Agosto</span></div><div className="cashflow-bars">{[['Receitas',18720,88],['Custos fixos',15460,72],['Custos variáveis',4944,31],['Impostos',3475,22]].map(([label,value,width])=><div className="cashflow-row" key={String(label)}><span>{label}</span><div><i style={{width:`${width}%`}}/></div><strong>{money.format(Number(value))}</strong></div>)}</div></section><section className="card"><h2>Atalhos financeiros</h2><div className="finance-shortcuts">{[
      [Landmark,'Contas a pagar','5 vencimentos próximos','payable'],
      [ReceiptText,'Contas a receber','1 título atrasado','receivable'],
      [Users,'Folha salarial','Fechamento em 12 dias','payroll'],
      [FileCheck2,'Notas fiscais','1 aguardando emissão','invoices'],
    ].map(([Icon,label,note,id])=><button key={String(id)} onClick={()=>setView(id as FinanceView)}><Icon/><span><strong>{String(label)}</strong><small>{String(note)}</small></span><ArrowUpRight/></button>)}</div></section></div>
  </>
}

function Payable(){return <FinanceTable title="Contas a pagar" subtitle="Fornecedores, despesas recorrentes e compromissos futuros." rows={payable} headers={['Descrição','Categoria','Vencimento','Valor','Status']}/>}
function Receivable(){return <FinanceTable title="Contas a receber" subtitle="Atendimentos, pacotes e cobranças pendentes." rows={receivable} headers={['Cliente','Serviço','Vencimento','Valor','Status']}/>}

function Costs(){const fixed=fixedCosts.reduce((s,x)=>s+Number(x[1]),0);const variable=variableCosts.reduce((s,x)=>s+Number(x[1]),0);return <><div className="grid grid-3"><Metric icon={Building2} label="Custos fixos" value={money.format(fixed)}/><Metric icon={BadgeDollarSign} label="Custos variáveis" value={money.format(variable)}/><Metric icon={Wallet} label="Custo operacional" value={money.format(fixed+variable)}/></div><div className="grid grid-2" style={{marginTop:18}}><CostList title="Custos fixos mensais" items={fixedCosts}/><CostList title="Custos variáveis no mês" items={variableCosts}/></div></>}

function Taxes(){return <><div className="alert tax-note"><strong>Simulação tributária:</strong> alíquotas e obrigações dependem do município, regime tributário e atividade. Valide com a contabilidade.</div><FinanceTable title="Impostos e obrigações" subtitle="Provisões e vencimentos do período." rows={taxes} headers={['Obrigação','Vencimento','Valor previsto','Status']}/></>}

function Payroll(){return <><div className="grid grid-4"><Metric icon={Users} label="Colaboradores" value="3"/><Metric icon={CircleDollarSign} label="Salários brutos" value="R$ 7.100"/><Metric icon={BadgeDollarSign} label="Encargos e benefícios" value="R$ 3.728"/><Metric icon={Wallet} label="Custo total da folha" value="R$ 10.828"/></div><FinanceTable title="Folha salarial" subtitle="Salários, benefícios, encargos e valor líquido." rows={employees} headers={['Colaborador','Cargo','Salário bruto','Benefícios','Encargos','Líquido']}/></>}

function Invoices(){return <><div className="invoice-toolbar card"><div><h2>Emissão de NFS-e</h2><p className="muted">Prepare e acompanhe notas fiscais de serviço. A emissão real dependerá da integração com a prefeitura ou provedor fiscal.</p></div><button className="btn btn-primary"><FileText size={17}/> Emitir nota fiscal</button></div><FinanceTable title="Notas fiscais" subtitle="Documentos emitidos, pendentes e cancelados." rows={invoices} headers={['Número','Tomador','Serviço','Valor','Status']}/></>}

function FinanceTable({title,subtitle,rows,headers}:{title:string;subtitle:string;rows:(string|number)[][];headers:string[]}){return <section className="card finance-table-card"><div className="section-heading"><div><h2>{title}</h2><p className="muted">{subtitle}</p></div><button className="btn btn-secondary">Exportar</button></div><div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{typeof cell==='number'?<strong>{money.format(cell)}</strong>:j===row.length-1?<span className="badge">{cell}</span>:cell}</td>)}</tr>)}</tbody></table></div></section>}
function CostList({title,items}:{title:string;items:(string|number)[][]}){return <section className="card"><div className="section-heading"><h2>{title}</h2><button className="icon-btn"><Plus/></button></div><div className="cost-list">{items.map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{money.format(Number(value))}</strong></div>)}</div></section>}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="card admin-metric"><div className="metric-icon"><Icon/></div><div><span className="muted">{label}</span><h2>{value}</h2></div></div>}
