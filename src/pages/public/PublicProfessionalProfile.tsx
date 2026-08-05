import {
  Baby,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  CreditCard,
  Heart,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Search,
  Share2,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getProfileBySlug } from '../../lib/professionalProfile'

const clinicServices = [
  ['Consulta Pediátrica', 'Avaliação completa da saúde da criança', '🩺'],
  ['Puericultura', 'Acompanhamento do crescimento e desenvolvimento', '👶'],
  ['Vacinas', 'Calendário vacinal completo e personalizado', '💉'],
  ['Alergia e Imunologia', 'Diagnóstico e tratamento de alergias', '🧸'],
  ['Disfunções Alimentares', 'Orientação e acompanhamento nutricional', '🥣'],
]

const team = [
  ['Dra. Marina Lopes', 'Pediatria e Puericultura', 'ML'],
  ['Dra. Fernanda Alves', 'Alergia e Imunologia', 'FA'],
  ['Dra. Camila Rocha', 'Nutrição Infantil', 'CR'],
]

export function PublicProfessionalProfile() {
  const { slug = '' } = useParams()
  const storedProfile = getProfileBySlug(slug)
  const clinicDemo = slug === 'clinica-crescer-pediatria'
  const displayName = clinicDemo ? 'Clínica Crescer Pediatria' : storedProfile?.displayName

  if (!displayName) return <div className="auth-page"><div className="auth-card success-card"><Logo /><h1>Perfil não encontrado</h1><p className="muted">Este endereço pode ter sido alterado ou ainda não foi publicado.</p><Link className="btn btn-primary" to="/profissionais">Voltar para a busca</Link></div></div>

  const specialty = clinicDemo ? 'Pediatria · Puericultura' : storedProfile?.specialty
  const city = clinicDemo ? 'Cambuí · Campinas, SP' : storedProfile?.city
  const phone = clinicDemo ? '(19) 99988-7766' : storedProfile?.phone
  const description = clinicDemo
    ? 'Cuidado que acompanha cada fase do seu filho.'
    : storedProfile?.headline || 'Atendimento materno-infantil acolhedor, seguro e baseado em evidências.'
  const about = clinicDemo
    ? 'A Clínica Crescer Pediatria oferece atendimento humanizado e completo para crianças e adolescentes. Nossa missão é cuidar da saúde dos pequenos com carinho, atenção e excelência em cada detalhe.'
    : storedProfile?.about

  return <div className="clinic-profile-page">
    <header className="portal-topbar compact">
      <Link to="/"><Logo /></Link>
      <Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link>
      <div className="portal-header-actions"><button aria-label="Buscar"><Search /></button><button aria-label="Notificações"><Bell /></button><button aria-label="Menu"><Menu /></button></div>
    </header>

    <section className="profile-search-strip">
      <p><Heart /> Paciente, insira seu nome e telefone e faça sua consulta gratuitamente.</p>
      <form>
        <label><span>Nome da paciente</span><input defaultValue="Maria Silva" /></label>
        <label><span>Telefone com DDD</span><input defaultValue="(19) 99876-5432" /></label>
        <label><span>Especialidade</span><select defaultValue="Pediatria"><option>Pediatria</option><option>Fonoaudiologia</option><option>Nutrição Infantil</option></select></label>
        <label><span>Cidade</span><select defaultValue="Campinas, SP"><option>Campinas, SP</option><option>São Paulo, SP</option></select></label>
        <button><Search />Buscar agora</button>
      </form>
    </section>

    <nav className="portal-categories profile-nav"><Link to="/">Início</Link><a href="#sobre"><Heart />Gestação</a><a href="#servicos"><Baby />Bebê</a><a href="#equipe"><Users />Profissionais</a><a href="#avaliacoes"><Star />Avaliações</a></nav>

    <main className="clinic-profile-shell">
      <div className="profile-breadcrumbs"><Link to="/">Início</Link><span>›</span><Link to="/profissionais">Buscar</Link><span>›</span><strong>{displayName}</strong></div>

      <section className="clinic-cover">
        <div className="clinic-cover-art"><span>Perfil Premium</span><div className="cover-shapes"><i /><i /><i /></div></div>
        <div className="clinic-profile-main">
          <div className="clinic-logo">{clinicDemo ? <><Baby /><b>CRESCER<small>pediatria</small></b></> : displayName.split(' ').slice(0, 2).map(part => part[0]).join('')}</div>
          <div className="clinic-identity">
            <h1>{displayName}<CheckCircle2 /></h1>
            <p>{description}</p>
            <div className="clinic-rating"><strong>5,0</strong>{[1, 2, 3, 4, 5].map(n => <Star key={n} fill="currentColor" />)}<span>(124 avaliações)</span></div>
            <div className="service-tags">{String(specialty).split(' · ').map(tag => <span key={tag}>{tag}</span>)}</div>
            {!clinicDemo && <small className="clinic-caption">Profissional vinculada à Rede Maternar</small>}
          </div>
          <div className="clinic-profile-actions"><button><Share2 />Compartilhar perfil</button><button><Heart />Salvar profissional</button><button><Star />Avaliar profissional</button></div>
        </div>

        <div className="clinic-contact-grid">
          <div><Stethoscope /><span><b>Telefone / WhatsApp</b><strong>{phone || 'Disponível após contato'}</strong></span></div>
          <div><Mail /><span><b>E-mail</b><strong>contato@redematernar.com.br</strong></span></div>
          <div><MapPin /><span><b>Localização</b><strong>{city}</strong><small>Endereço completo compartilhado no contato</small></span></div>
          <div><Clock3 /><span><b>Horário de atendimento</b><strong>Segunda a Sexta: 8h às 18h</strong><small>Sábado: 8h às 12h</small></span></div>
        </div>
        <div className="clinic-cta-row"><button className="whatsapp">Falar no WhatsApp</button><button><Mail />Enviar e-mail</button><button className="instagram"><Instagram />Seguir no Instagram</button></div>
      </section>

      <section className="clinic-info-grid" id="sobre">
        <article><h2>Sobre {clinicDemo ? 'a clínica' : 'a profissional'}</h2><p>{about || 'Apresentação profissional em atualização.'}</p><ul><li>Atendimento acolhedor e individualizado</li><li>Equipe especializada e atualizada</li><li>Ambiente seguro para mães, bebês e crianças</li><li>Atendimento particular e por convênios</li></ul></article>
        <article><h2>Formas de pagamento</h2><p><CreditCard /> Dinheiro</p><p><CreditCard /> Cartão de Débito</p><p><CreditCard /> Cartão de Crédito</p><p><CreditCard /> PIX</p></article>
        <article><h2>Convênios atendidos</h2><div className="insurance-logo-grid">{['Unimed', 'SulAmérica', 'Bradesco Saúde', 'Amil', 'NotreDame', 'Amil One'].map(item => <strong key={item}>{item}</strong>)}</div><button className="outline-small">Ver todos os convênios</button></article>
      </section>

      <section className="clinic-section-card" id="servicos">
        <h2><Stethoscope /> Serviços oferecidos</h2>
        <div className="clinic-service-cards">{clinicServices.map(([name, copy, icon]) => <article key={name}><div>{icon}</div><h3>{name}</h3><p>{copy}</p></article>)}</div>
      </section>

      {clinicDemo && <section className="clinic-section-card" id="equipe">
        <h2><Users /> Profissionais da clínica</h2>
        <p className="section-intro">Conheça as profissionais que realizam os atendimentos. O nome de cada profissional permanece em destaque no marketplace.</p>
        <div className="clinic-team-cards">{team.map(([name, role, initials]) => <article key={name}><div>{initials}</div><span><h3>{name}</h3><p>{role}</p><button>Ver perfil profissional</button></span></article>)}</div>
      </section>}

      <section className="clinic-section-card">
        <h2><Camera /> Fotos {clinicDemo ? 'da clínica' : 'do consultório'}</h2>
        <div className="clinic-gallery">{['Recepção', 'Espaço infantil', 'Consultório', 'Sala de atendimento', 'Ver todas as fotos'].map((label, index) => <div key={label} className={`gallery-${index + 1}`}><span>{label}</span></div>)}</div>
      </section>

      <section className="clinic-reviews" id="avaliacoes">
        <div><h2>Avaliações de pacientes</h2><strong>5,0</strong><span>{[1, 2, 3, 4, 5].map(n => <Star key={n} fill="currentColor" />)}</span><small>Com base em 124 avaliações</small></div>
        {[['Juliana M.', 'Ótimo atendimento! Muito atenciosa e meu filho se sente à vontade.'], ['Ricardo A.', 'Ambiente impecável e equipe maravilhosa.'], ['Fernanda L.', 'Acompanhamos desde o nascimento do meu bebê. Super indico!']].map(([name, copy]) => <article key={name}><b>{name}</b><span>{[1, 2, 3, 4, 5].map(n => <Star key={n} fill="currentColor" />)}</span><p>{copy}</p><small>Atendimento verificado</small></article>)}
      </section>

      <section className="newsletter-card profile-newsletter"><div><Building2 /><span><strong>Receba conteúdos exclusivos para uma maternidade mais leve</strong><small>Artigos, dicas e novidades direto no seu e-mail.</small></span></div><form><input type="email" placeholder="Seu melhor e-mail" /><button>Quero receber</button></form></section>
    </main>
  </div>
}
