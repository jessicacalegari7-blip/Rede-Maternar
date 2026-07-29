import { Check, Eye, Sparkles } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { planFeatures, planLabels, type ProfessionalPlan } from '../../lib/plans'

const prices: Record<ProfessionalPlan,string> = { free:'R$ 0', marketplace:'R$ 29,90/mês', business:'R$ 159,90/mês', annual:'R$ 159,90/mês' }

export function ProfessionalPlanPage() {
  const { user } = useAuth()
  const plan = user?.plan ?? 'free'
  return <div><div className="page-heading"><div><span className="badge">Assinatura</span><h1>{planLabels[plan]}</h1><p className="muted">Escolha o nível de visibilidade e gestão adequado ao seu momento.</p></div></div>
    <div className="usage-card card"><div><Eye/><span><strong>{plan==='free'?'18 de 30 visitas utilizadas':'Visitas ilimitadas'}</strong><small>Seu perfil no Marketplace neste mês</small></span></div>{plan==='free'&&<div className="progress"><i style={{width:'60%'}}/></div>}</div>
    <div className="pricing-grid pricing-grid-3 plan-page-grid">{(['free','marketplace','business'] as ProfessionalPlan[]).map(item=><article className={`pricing-card ${item==='business'?'featured':''}`} key={item}><span className="badge">{item===plan?'Plano atual':item==='business'?'Mais completo':'Marketplace'}</span><h3>{planLabels[item]}</h3><div className="price">{prices[item]}</div>{planFeatures[item].map(f=><p className="feature" key={f}><Check size={18}/>{f}</p>)}{item===plan?<div className="alert alert-success">Seu plano está ativo.</div>:<button className="btn btn-primary full" onClick={()=>alert('Contratação simulada. A integração com a Asaas será feita na versão de produção.')}><Sparkles size={17}/> Escolher este plano</button>}</article>)}</div>
  </div>
}
