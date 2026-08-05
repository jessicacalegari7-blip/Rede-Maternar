import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, CreditCard, MapPin, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getMarketplaceProfessional, listPublicServices } from '../../lib/operations'
import { LegalFooter } from './Legal'

export function PublicProfessionalProfile() {
  const {slug=''}=useParams(); const [profile,setProfile]=useState<any>(); const [services,setServices]=useState<any[]>([]); const [loaded,setLoaded]=useState(false)
  useEffect(()=>{void getMarketplaceProfessional(slug).then(async p=>{setProfile(p);if(p)setServices(await listPublicServices(p.id))}).finally(()=>setLoaded(true))},[slug])
  if(!loaded)return <div className="auth-page"><div className="auth-card">Carregando perfil...</div></div>
  if(!profile)return <div className="auth-page"><div className="auth-card"><Logo/><h1>Perfil não encontrado</h1><p>O perfil não está publicado ou não existe.</p><Link className="btn btn-primary" to="/profissionais">Voltar à busca</Link></div></div>
  const whats=String(profile.whatsapp||'').replace(/\D/g,'')
  return <div className="clinic-profile-page">
    <header className="portal-topbar compact"><Link to="/"><Logo/></Link><Link className="btn btn-secondary" to="/login">Profissional de Saúde</Link></header>
    <main className="clinic-profile-shell">
      <section className="clinic-cover"><div className="clinic-profile-main"><div className="clinic-logo">{profile.full_name.split(' ').slice(0,2).map((x:string)=>x[0]).join('')}</div><div className="clinic-identity">
        <h1>{profile.full_name}{profile.verified&&<CheckCircle2/>}</h1>{profile.clinic_name&&<strong>{profile.clinic_name}</strong>}
        <p>{profile.bio||'Perfil profissional cadastrado na Rede Maternar.'}</p>
        <div className="clinic-rating"><strong>{Number(profile.rating).toFixed(1)}</strong><Star fill="currentColor"/><span>({profile.review_count} avaliações)</span></div>
        <div className="service-tags">{profile.specialties.map((x:string)=><span key={x}>{x}</span>)}</div>
      </div></div>
      <div className="clinic-contact-grid"><div><MapPin/><span><b>Localização</b><strong>{[profile.neighborhood,profile.city,profile.state_code].filter(Boolean).join(' · ')}</strong></span></div><div><Clock3/><span><b>Atendimento</b><strong>{profile.accepts_online?'Presencial e online':'Presencial'}</strong></span></div></div>
      {whats&&<div className="clinic-cta-row"><a className="btn btn-primary whatsapp" href={`https://wa.me/${whats}`} target="_blank" rel="noreferrer">Falar no WhatsApp</a></div>}
      </section>
      <section className="clinic-info-grid"><article><h2>Sobre</h2><p>{profile.bio||'Informações em atualização.'}</p></article><article><h2><CreditCard/> Formas de pagamento</h2>{profile.payment_methods.length?profile.payment_methods.map((x:string)=><p key={x}>{x}</p>):<p>Consulte a profissional.</p>}</article><article><h2>Convênios</h2>{profile.accepted_insurances.length?profile.accepted_insurances.map((x:string)=><p key={x}>{x}</p>):<p>Atendimento particular ou informação não cadastrada.</p>}</article></section>
      <section className="clinic-section-card"><h2>Serviços oferecidos</h2>{services.length?<div className="clinic-service-cards">{services.map(s=><article key={s.id}><h3>{s.name}</h3><p>{s.description||'Serviço profissional'}</p><small>{s.duration_minutes} min · {(s.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</small></article>)}</div>:<p>Nenhum serviço publicado.</p>}</section>
    </main><LegalFooter/>
  </div>
}
