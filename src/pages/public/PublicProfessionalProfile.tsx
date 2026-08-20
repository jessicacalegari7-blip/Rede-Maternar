import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, CreditCard, ExternalLink, MapPin, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getMarketplaceProfessional, listPublicServices, recordProfessionalProfileView } from '../../lib/operations'
import { LegalFooter } from './Legal'

export function PublicProfessionalProfile() {
  const {slug=''}=useParams(); const [profile,setProfile]=useState<any>(); const [services,setServices]=useState<any[]>([]); const [loaded,setLoaded]=useState(false)
  useEffect(()=>{void getMarketplaceProfessional(slug).then(async p=>{setProfile(p);if(p){await recordProfessionalProfileView(p.id);setServices(await listPublicServices(p.id))}}).finally(()=>setLoaded(true))},[slug])
  if(!loaded)return <div className="auth-page"><div className="auth-card">Carregando perfil...</div></div>
  if(!profile)return <div className="auth-page"><div className="auth-card"><Logo/><h1>Perfil não encontrado</h1><p>O perfil não está publicado ou não existe.</p><Link className="btn btn-primary" to="/profissionais">Voltar à busca</Link></div></div>
  const whats=String(profile.whatsapp||'').replace(/\D/g,'')
  return <div className="clinic-profile-page">
    <header className="portal-topbar compact"><Link to="/"><Logo/></Link><Link className="btn btn-secondary" to="/login">Profissional de Saúde</Link></header>
    <main className="clinic-profile-shell">
      <section className="clinic-cover" style={profile.cover_image_url?{backgroundImage:`linear-gradient(90deg,rgba(255,255,255,.94),rgba(255,255,255,.38)),url(${profile.cover_image_url})`,backgroundSize:'cover',backgroundPosition:'center'}:undefined}><div className="clinic-profile-main"><div className="clinic-logo">{profile.profile_image_url?<img src={profile.profile_image_url} alt={`Foto de ${profile.full_name}`} width="160" height="160"/>:profile.full_name.split(' ').slice(0,2).map((x:string)=>x[0]).join('')}</div><div className="clinic-identity">
        <h1>{profile.full_name}{profile.verified&&<CheckCircle2/>}</h1>{profile.clinic_name&&<strong>{profile.clinic_name}</strong>}
        <p>{profile.bio||'Perfil profissional cadastrado na MaterPlace.'}</p>
        <div className="clinic-rating"><strong>{Number(profile.rating).toFixed(1)}</strong><Star fill="currentColor"/><span>({profile.review_count} avaliações)</span></div>
        <div className="service-tags">{profile.specialties.map((x:string)=><span key={x}>{x}</span>)}</div>
      </div></div>
      <div className="clinic-contact-grid"><div><MapPin/><span><b>Localização</b><strong>{[profile.neighborhood,profile.city,profile.state_code].filter(Boolean).join(' · ')}</strong></span></div><div><Clock3/><span><b>Atendimento</b><strong>{profile.accepts_online?'Presencial e online':'Presencial'}</strong></span></div></div>
      {whats&&<div className="clinic-cta-row"><a className="btn btn-primary whatsapp" href={`https://wa.me/${whats}`} target="_blank" rel="noreferrer">Falar no WhatsApp</a></div>}
      </section>
      <section className="clinic-info-grid"><article><h2>Sobre</h2><p>{profile.clinic_description||profile.bio||'Informações em atualização.'}</p>{profile.opening_hours&&<p><strong>Horários:</strong> {profile.opening_hours}</p>}<div className="profile-social-links">{profile.website_url&&<a href={profile.website_url} target="_blank" rel="noreferrer"><ExternalLink/>Site</a>}{profile.instagram_handle&&<a href={profile.instagram_handle.startsWith('http')?profile.instagram_handle:`https://instagram.com/${profile.instagram_handle.replace('@','')}`} target="_blank" rel="noreferrer">Instagram</a>}{profile.facebook_url&&<a href={profile.facebook_url} target="_blank" rel="noreferrer">Facebook</a>}{profile.tiktok_url&&<a href={profile.tiktok_url} target="_blank" rel="noreferrer">TikTok</a>}</div></article><article><h2><CreditCard/> Formas de pagamento</h2>{profile.payment_methods.length?profile.payment_methods.map((x:string)=><p key={x}>{x}</p>):<p>Consulte a profissional.</p>}</article><article><h2>Convênios</h2>{profile.accepted_insurances.length?profile.accepted_insurances.map((x:string)=><p key={x}>{x}</p>):<p>Atendimento particular ou informação não cadastrada.</p>}</article></section>
      <section className="clinic-section-card"><h2>Serviços oferecidos</h2>{services.length?<div className="clinic-service-cards">{services.map(s=><article key={s.id}><h3>{s.name}</h3><p>{s.description||s.specialty||'Serviço profissional'}</p>{s.professional_name&&<strong>{s.professional_name} {s.professional_registration&&`· ${s.professional_registration}`}</strong>}<small>{s.duration_minutes} min · {(s.price_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} · {(s.attendance_modes||[]).join(', ')}</small></article>)}</div>:<p>Nenhum serviço publicado.</p>}</section>
      {(profile.office_video_urls?.length>0||profile.office_video_url)&&<section className="clinic-section-card"><h2>Vídeos da clínica</h2><div className="clinic-videos">{(profile.office_video_urls?.length?profile.office_video_urls:[profile.office_video_url]).filter(Boolean).map((url:string)=><video key={url} controls preload="metadata" src={url}/>)}</div></section>}
      {profile.gallery_urls?.length>0&&<section className="clinic-section-card"><h2>Fotos da clínica</h2><div className="clinic-gallery">{profile.gallery_urls.map((url:string)=><img key={url} src={url} alt={`Ambiente de ${profile.clinic_name||profile.full_name}`} loading="lazy" width="480" height="320"/>)}</div></section>}
    </main><LegalFooter/>
  </div>
}
