import { FormEvent, useEffect, useState } from 'react'
import { Baby, Bell, BookOpen, ChevronRight, Heart, Menu, Mic2, Play, Search, Sparkles, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { maternalChildSpecialties } from '../../data/specialties'
import { listPortalArticles, type PortalArticle } from '../../lib/news'
import { LegalFooter } from './Legal'

const categories = [
  { label: 'Gestação', icon: Heart }, { label: 'Bebê', icon: Baby },
  { label: 'Primeira Infância', icon: Sparkles }, { label: 'Família', icon: Users },
  { label: 'Bem-estar', icon: Heart },
]
const fallbackHeadlines = [
  { category: 'Amamentação', title: 'Amamentação sem dor: 7 dicas para tornar esse momento mais leve', meta: '6 min', tone: 'rose' },
  { category: 'Desenvolvimento', title: 'Marcos do desenvolvimento infantil: o que observar nos primeiros 12 meses', meta: '7 min', tone: 'gold' },
  { category: 'Saúde infantil', title: 'Vacinas em dia: proteção que acompanha cada fase do crescimento', meta: '5 min', tone: 'sage' },
]
const fallbackMostRead = [
  ['Licença-maternidade: seus direitos e como funciona', 'Gestação'],
  ['Introdução alimentar: quando começar e por onde iniciar', 'Bebê'],
  ['Sono do bebê: como criar uma rotina saudável', 'Bem-estar'],
  ['Sinais de alerta na gestação que você não deve ignorar', 'Gestação'],
]
const articleDate = (article: PortalArticle) => new Date(article.publishedAt || article.createdAt).toLocaleDateString('pt-BR')

export function PortalHome() {
  const navigate = useNavigate()
  const [articles, setArticles] = useState<PortalArticle[]>([])
  useEffect(() => { void listPortalArticles().then(setArticles).catch(() => setArticles([])) }, [])

  function searchProfessionals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const query = new URLSearchParams()
    const fields = [['name', 'nome'], ['phone', 'telefone'], ['specialty', 'especialidade'], ['city', 'cidade']] as const
    fields.forEach(([field, parameter]) => { const value = String(form.get(field) || ''); if (value) query.set(parameter, value) })
    navigate(`/profissionais${query.size ? `?${query.toString()}` : ''}`)
  }

  const featured = articles[0]
  const headlineArticles = articles.slice(1, 4)
  const mostReadArticles = articles.slice(4, 8)

  return <div className="portal-home">
    <header className="portal-topbar">
      <Link to="/" aria-label="Início"><Logo /></Link>
      <Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link>
      <div className="portal-header-actions"><button aria-label="Buscar"><Search /></button><button aria-label="Notificações"><Bell /></button><button aria-label="Menu"><Menu /></button></div>
    </header>

    <section className="portal-search">
      <span className="brand-manifesto">Conecta · Acolhe · Transforma</span>
      <h1>Encontre a profissional <em>materno-infantil mais próxima de você</em></h1>
      <p>Busque por especialidade e localização.</p>
      <form onSubmit={searchProfessionals}>
        <label><span>Nome</span><input name="name" placeholder="Ex.: Maria Silva" /></label>
        <label><span>Telefone com DDD</span><input name="phone" placeholder="Ex.: (11) 99999-9999" /></label>
        <label><span>Especialidade</span><select name="specialty"><option value="">Escolha uma especialidade</option>{maternalChildSpecialties.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Cidade</span><input name="city" placeholder="Ex.: São Paulo, SP" /></label>
        <button className="portal-search-button"><Search /> Buscar agora</button>
      </form>
      <div className="patient-search-note"><Heart /> Paciente, insira seu nome e telefone e faça sua consulta gratuitamente.</div>
    </section>

    <nav className="portal-categories" aria-label="Categorias">
      <Link className="active" to="/">Início</Link>
      {categories.map(({ label, icon: Icon }) => <a key={label} href={`#${label.toLowerCase().replace(' ', '-')}`}><Icon />{label}</a>)}
      <a href="#videos"><Play />Vídeos</a><a href="#podcasts"><Mic2 />Podcasts</a>
    </nav>

    <main className="portal-content">
      <section className="sponsor-strip"><span>Apoiam uma maternidade mais leve</span>{['Pampers', 'Mustela', 'Philips Avent', 'Unimed', "Johnson's"].map(name => <strong key={name}>{name}</strong>)}<button>Seja um patrocinador</button></section>

      <div className="portal-lead-grid">
        <article className={`lead-story${featured?.coverImageUrl ? ' has-real-image' : ''}`} style={featured?.coverImageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(7,30,24,.9), rgba(7,30,24,.12)), url(${featured.coverImageUrl})` } : undefined}>
          <span>{featured?.category || 'Gestação'}</span>
          <div><h2>{featured?.title || 'Pré-natal: por que cada consulta é essencial para a saúde da mãe e do bebê'}</h2><p>{featured?.excerpt || 'Acompanhamento regular reduz riscos e garante mais segurança durante toda a gestação.'}</p>{featured ? <Link className="story-link" to={`/noticias/${featured.slug}`}>Ler notícia · {articleDate(featured)}</Link> : <small>5 min de leitura</small>}</div>
          {!featured?.coverImageUrl && <div className="story-illustration">🤰</div>}
        </article>
        <section className="headline-list">
          {[0, 1, 2].map(index => { const real = headlineArticles[index]; const fallback = fallbackHeadlines[index]; return <article key={real?.id || fallback.title}>{real?.coverImageUrl ? <img className="news-thumb-image" src={real.coverImageUrl} alt="" /> : <div className={`news-thumb ${fallback.tone}`}>{fallback.category === 'Desenvolvimento' ? '🧸' : fallback.category === 'Saúde infantil' ? '🩺' : '🤱'}</div>}<div><span>{real?.category || fallback.category}</span><h3>{real?.title || fallback.title}</h3><small>{real ? articleDate(real) : `${fallback.meta} de leitura`}</small>{real && <Link to={`/noticias/${real.slug}`}>Ler notícia</Link>}</div></article> })}
        </section>
        <aside className="portal-ad"><span>Espaço de cuidado</span><h3>Conteúdo que acolhe cada fase.</h3><Baby /><button>Conheça agora</button></aside>
      </div>

      <section className="most-read-section"><div className="portal-section-title"><h2>Mais lidas</h2><a href="#noticias">Ver todas</a></div><div className="most-read-grid">
        {[0, 1, 2, 3].map(index => { const real = mostReadArticles[index]; const [title, category] = fallbackMostRead[index]; return <article key={real?.id || title}><span>{index + 1}</span>{real?.coverImageUrl ? <img className="most-read-image" src={real.coverImageUrl} alt="" /> : <div className={`most-read-art art-${index + 1}`}>{['🤰', '🥣', '👶', '💗'][index]}</div>}<small>{real?.category || category}</small><h3>{real?.title || title}</h3><p>{real?.excerpt || 'Leitura rápida e orientação confiável para a sua jornada.'}</p>{real && <Link to={`/noticias/${real.slug}`}>Ler notícia</Link>}</article> })}
      </div></section>

      <section className="newsletter-card"><div><BookOpen /><span><strong>Receba conteúdos exclusivos para uma maternidade mais leve</strong><small>Artigos, dicas e novidades direto no seu e-mail.</small></span></div><form onSubmit={event => event.preventDefault()}><input type="email" placeholder="Seu melhor e-mail" /><button>Quero receber</button></form></section>
      <div className="portal-bottom-grid">
        <section id="podcasts" className="portal-media-section"><div className="portal-section-title"><h2>Podcasts</h2><a href="#podcasts">Ver todos</a></div><article className="podcast-card"><div><Mic2 /><b>Materna em pauta</b><small>EP. 23</small></div><span><strong>Como lidar com a ansiedade na gestação com informação</strong><small>com Psicóloga Juliana Martins</small><button><Play /> Ouvir agora</button></span></article></section>
        <section id="videos" className="portal-media-section"><div className="portal-section-title"><h2>Vídeos em destaque</h2><a href="#videos">Ver todos</a></div><div className="video-cards">{['Alongamento na gravidez', 'Como escolher a melhor chupeta', 'Banho de ofurô'].map((title, index) => <article key={title}><div>{index === 0 ? '🤰' : index === 1 ? '👶' : '🛁'}<Play /></div><strong>{title}</strong></article>)}</div></section>
      </div>
      <section className="professional-cta"><div><span>Para profissionais</span><h2>Quer divulgar seu trabalho e organizar sua clínica?</h2><p>Conheça o Marketplace + CRM + ERP da MaterPlace.</p></div><Link className="btn btn-primary" to="/para-profissionais">Conhecer a plataforma <ChevronRight /></Link></section>
    </main><LegalFooter />
  </div>
}
