import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, ExternalLink, MapPin, MessageCircle, Star } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getProfileBySlug, modeLabels } from '../../lib/professionalProfile'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function PublicProfessionalProfile() {
  const { slug = '' } = useParams()
  const profile = getProfileBySlug(slug)

  if (!profile) return <div className="auth-page"><div className="auth-card success-card"><Logo/><h1>Perfil não encontrado</h1><p className="muted">Este endereço pode ter sido alterado ou ainda não foi publicado.</p><Link className="btn btn-primary" to="/">Voltar ao início</Link></div></div>

  return <div className="public-profile-page">
    <header className="public-header"><Logo/><Link to="/login" className="btn btn-secondary">Entrar</Link></header>
    <main className="public-profile-shell">
      <Link className="back-link" to="/"><ArrowLeft size={16}/> Rede Maternar</Link>
      <section className="public-profile-hero">
        <div className="public-avatar">{profile.displayName.split(' ').filter(Boolean).slice(0,2).map((part) => part[0]).join('')}</div>
        <div className="public-identity"><div className="verified-line"><span className="badge">Perfil verificado</span>{profile.acceptsNewPatients && <span className="availability-badge"><CheckCircle2 size={15}/> Novas pacientes</span>}</div><h1>{profile.displayName}</h1><h2>{profile.specialty}</h2><div className="profile-rating"><Star fill="currentColor"/><strong>4,9</strong><span>87 avaliações verificadas</span></div><p>{profile.headline}</p><div className="public-meta"><span><MapPin size={17}/>{profile.city}</span>{profile.registration && <span>{profile.registration}</span>}{profile.yearsExperience > 0 && <span>{profile.yearsExperience} anos de experiência</span>}</div></div>
        <aside className="contact-card"><h3>Fale com a profissional</h3><p className="muted">Agendamentos são feitos por convite ou vínculo com a profissional.</p><button className="btn btn-primary"><CalendarDays size={17}/> Solicitar agendamento</button><button className="btn btn-secondary"><MessageCircle size={17}/> Enviar mensagem</button></aside>
      </section>

      <div className="public-content-grid">
        <div className="public-main-column">
          <section className="card public-section"><h2>Sobre</h2><p className="about-text">{profile.about || 'Esta profissional ainda não adicionou uma apresentação.'}</p></section>
          <section className="card public-section"><h2>Serviços</h2><div className="public-services">{profile.services.filter((service) => service.active).map((service) => <article className="public-service" key={service.id}><div><h3>{service.name}</h3><p>{service.description}</p><div className="service-tags"><span><Clock3 size={15}/>{service.durationMinutes} min</span>{service.modes.map((mode) => <span key={mode}>{modeLabels[mode]}</span>)}</div></div><strong>{currency.format(service.price)}</strong></article>)}{profile.services.filter((service) => service.active).length === 0 && <p className="muted">Nenhum serviço publicado no momento.</p>}</div></section>
          <section className="card public-section" id="avaliacoes"><div className="section-heading"><div><h2>Avaliações da profissional</h2><p className="muted">Somente pacientes com atendimento concluído podem avaliar.</p></div><div className="review-summary"><Star fill="currentColor"/><strong>4,9</strong><span>87 avaliações</span></div></div>{[['Carolina M.','5,0','Atendimento muito cuidadoso e explicações claras.'],['Fernanda A.','5,0','Senti segurança desde o primeiro contato.'],['Juliana R.','4,8','Pontual, acolhedora e muito atenciosa.']].map(([name,note,text])=><article className="review-item" key={name}><div><strong>{name}</strong><span><Star fill="currentColor"/>{note}</span></div><p>{text}</p><small>Atendimento verificado · identidade protegida</small></article>)}</section>
        </div>
        <aside className="public-side-column">
          <section className="card public-section"><h2>Disponibilidade</h2><div className="availability-summary">{profile.availability.filter((day) => day.enabled).slice(0,5).map((day) => <div key={day.weekday}><span>{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][day.weekday]}</span><strong>{day.start}–{day.end}</strong></div>)}</div><p className="small-note">Os horários exibidos são uma referência e dependem de confirmação.</p></section>
          {(profile.instagram || profile.website) && <section className="card public-section"><h2>Links</h2>{profile.instagram && <div className="external-row"><span>Instagram</span><strong>{profile.instagram}</strong></div>}{profile.website && <a className="external-row" href={profile.website} target="_blank" rel="noreferrer"><span>Site</span><ExternalLink size={16}/></a>}</section>}
        </aside>
      </div>
    </main>
  </div>
}
