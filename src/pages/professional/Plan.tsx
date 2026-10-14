import { Check, Eye, Sparkles } from 'lucide-react'
import {Link} from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { planFeatures, planLabels, type ProfessionalPlan } from '../../lib/plans'

const prices: Record<ProfessionalPlan,string> = { free:'Plano legado', marketplace:'R$ 59,99 / 12 meses', independent:'A partir de R$ 59,90/mês', clinic:'A partir de R$ 99,90/mês', business:'Sob consulta', annual:'Plano legado' }

export function ProfessionalPlanPage() {
  const { user } = useAuth()
  const plan = user?.plan ?? 'free'
  return <div><div className="page-heading"><div><span className="badge">Assinatura</span><h1>{planLabels[plan]}</h1><p className="muted">Escolha o nível de visibilidade e gestão adequado ao seu momento.</p></div></div>
    <div className="usage-card card"><div><Eye/><span><strong>{plan==='free'?'18 de 30 visitas utilizadas':'Visitas ilimitadas'}</strong><small>Seu perfil no Marketplace neste mês</small></span></div>{plan==='free'&&<div className="progress"><i style={{width:'60%'}}/></div>}</div>
    <div className="pricing-grid pricing-grid-4 plan-page-grid">{(['free','marketplace','independent','clinic'] as ProfessionalPlan[]).map(item=><article className={`pricing-card ${item==='marketplace'?'featured':''}`} key={item}><span className="badge">{item===plan?'Plano atual':item==='clinic'?'Para equipes':item==='marketplace'?'Oferta Premium':'Gestão completa'}</span><h3>{planLabels[item]}</h3><div className="price">{prices[item]}</div>{planFeatures[item].map(f=><p className="feature" key={f}><Check size={18}/>{f}</p>)}{item===plan?<div className="alert alert-success">Seu plano está ativo.</div>:item==='marketplace'?<Link className="btn btn-primary full" to="/cadastro-profissional?plano=marketplace"><Sparkles size={17}/> Contratar Perfil Premium</Link>:<div className="alert alert-warning">Contratação deste plano será liberada separadamente.</div>}</article>)}</div>
  </div>
}
