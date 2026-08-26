import { FormEvent, useEffect, useState } from 'react'
import { Baby, Bell, BookOpen, ChevronRight, Heart, Menu, Mic2, Play, Search, Sparkles, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { maternalChildSpecialties } from '../../data/specialties'
import { listPortalArticles, listPortalVideos, type PortalArticle, type PortalVideo } from '../../lib/news'
import { LegalFooter } from './Legal'

const articleDate = (article: PortalArticle) => new Date(article.publishedAt || article.createdAt).toLocaleDateString('pt-BR')

export function PortalHome() {
  const navigate = useNavigate()
  const { category: categorySlug = '' } = useParams()
  const [selectedCategory, setSelectedCategory] = useState('')
  const [articles, setArticles] = useState<PortalArticle[]>([])
  const [videos,setVideos]=useState<PortalVideo[]>([])
  const [articlesLoading,setArticlesLoading]=useState(true)
  useEffect(() => { void listPortalArticles().then(setArticles).catch(() => setArticles([])).finally(()=>setArticlesLoading(false));void listPortalVideos().then(setVideos) }, [])

  function searchProfessionals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const query = new URLSearchParams()
    const fields = [['name', 'nome'], ['phone', 'telefone'], ['specialty', 'especialidade'], ['city', 'cidade']] as const
    fields.forEach(([field, parameter]) => { const value = String(form.get(field) || ''); if (value) query.set(parameter, value) })
    if (fields.some(([field]) => !String(form.get(field) || '').trim())) { window.alert('Preencha seu nome, telefone, especialidade e cidade para realizar a busca.'); return }
    navigate(`/profissionais${query.size ? `?${query.toString()}` : ''}`)
  }

  const categoryKey=(value:string)=>value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
  const categoryMap=new Map<string,string>();articles.forEach(article=>{const key=categoryKey(article.category);if(key&&!categoryMap.has(key))categoryMap.set(key,article.category.trim())})
  const publishedCategories = Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  useEffect(()=>{if(!categorySlug){setSelectedCategory('');return}const match=publishedCategories.find(category=>categoryKey(category).replace(/\s+/g,'-')===categorySlug);setSelectedCategory(match||'')},[categorySlug,articles])
  const visibleArticles = selectedCategory ? articles.filter(article => categoryKey(article.category) === categoryKey(selectedCategory)) : articles
  const featured = visibleArticles[0]
  const headlineArticles = visibleArticles.slice(1, 4)
  const mostReadArticles = visibleArticles.slice(4, 8)
  const otherArticles = visibleArticles.slice(8)

  return <div className="portal-home">
    <header className="portal-topbar">
      <Link to="/" aria-label="Início"><Logo /></Link>
      <Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link>
      <nav className="portal-institutional-nav" aria-label="Menu institucional">
        <Link to="/sobre">Sobre</Link><Link to="/contato">Contato</Link><Link to="/privacidade">Privacidade</Link><Link to="/termos">Termos</Link><Link to="/cookies">Cookies</Link><Link to="/lgpd">LGPD</Link><Link to="/isencao-de-responsabilidade">Isenção</Link>
      </nav>
    </header>

    <section className="portal-search" id="buscar-profissionais">
      <span className="brand-manifesto">Conecta · Acolhe · Transforma</span>
      <h1>Encontre a profissional <em>materno-infantil mais próxima de você</em></h1>
      <p>Busque por especialidade e localização.</p>
      <form onSubmit={searchProfessionals}>
        <label><span>Seu Nome</span><input name="name" placeholder="Ex.: Maria Silva" /></label>
        <label><span>Seu Telefone</span><input name="phone" placeholder="Ex.: (11) 99999-9999" /></label>
        <label><span>Especialidade</span><select name="specialty"><option value="">Escolha uma especialidade</option>{maternalChildSpecialties.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Cidade</span><input name="city" placeholder="Ex.: São Paulo, SP" /></label>
        <button className="portal-search-button"><Search /> Buscar agora</button>
      </form>
      <div className="patient-search-note"><Heart /> Paciente, insira seu nome e telefone e faça sua busca por profissionais gratuitamente.</div>
    </section>

    <nav className="portal-categories" aria-label="Categorias">
      <button className={!selectedCategory?'active':''} type="button" onClick={()=>{setSelectedCategory('');window.scrollTo({top:0,behavior:'smooth'})}}>Início</button>
      {publishedCategories.map(label => <button className={selectedCategory === label ? 'active' : ''} type="button" key={label} onClick={() => setSelectedCategory(label)}>{label}</button>)}
      <a href="#videos"><Play />Vídeos</a><a href="#podcasts"><Mic2 />Podcasts</a>
    </nav>

    <main className="portal-content">
      <section className="sponsor-strip"><span>Apoiam uma maternidade mais leve</span>{['Pampers', 'Mustela', 'Philips Avent', 'Unimed', "Johnson's"].map(name => <strong key={name}>{name}</strong>)}<button>Seja um patrocinador</button></section>

      <div className="portal-lead-grid">
        <article className={`lead-story${featured?.coverImageUrl ? ' has-real-image' : ''}`}>
          {featured && <Link className="news-card-click-target" to={`/noticias/${featured.slug}`} aria-label={`Abrir matéria: ${featured.title}`} />}
          {featured ? <>{featured.coverImageUrl&&<img className="lead-story-image" src={featured.coverImageUrl} alt="" width="1600" height="900" fetchPriority="high" decoding="async"/>}<span>{featured.category}</span><div><h2>{featured.title}</h2><p>{featured.excerpt}</p><Link className="story-link" to={`/noticias/${featured.slug}`} aria-label={`Abrir matéria: ${featured.title}`}>Ler notícia · {articleDate(featured)}</Link></div>{!featured.coverImageUrl && <div className="story-illustration">📰</div>}</> : articlesLoading ? <div className="portal-news-skeleton" aria-label="Carregando matérias"><h2>Carregando conteúdos...</h2></div> : <div><h2>Nenhuma matéria publicada nesta categoria</h2><p>Novos conteúdos serão disponibilizados em breve.</p></div>}
        </article>
        <section className="headline-list">
          {headlineArticles.map(article => <article key={article.id}><Link className="news-card-click-target" to={`/noticias/${article.slug}`} aria-label={`Abrir matéria: ${article.title}`} />{article.coverImageUrl ? <img className="news-thumb-image" src={article.coverImageUrl} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="320" height="180" /> : <div className="news-thumb sage">📰</div>}<div><span>{article.category}</span><h3>{article.title}</h3><small>{articleDate(article)}</small><Link className="news-read-link" to={`/noticias/${article.slug}`} aria-label={`Abrir matéria: ${article.title}`}>Ler notícia</Link></div></article>)}
        </section>
        <aside className="portal-ad"><span>Espaço de cuidado</span><h3>Conteúdo que acolhe cada fase.</h3><Baby /><button>Conheça agora</button></aside>
      </div>

      <section className="most-read-section"><div className="portal-section-title"><h2>Mais lidas</h2><a href="#noticias">Ver todas</a></div><div className="most-read-grid">
        {mostReadArticles.map((article,index) => <article key={article.id}><Link className="news-card-click-target" to={`/noticias/${article.slug}`} aria-label={`Abrir matéria: ${article.title}`} /><span>{index + 1}</span>{article.coverImageUrl ? <img className="most-read-image" src={article.coverImageUrl} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="360" height="200" /> : <div className={`most-read-art art-${index + 1}`}>📰</div>}<small>{article.category}</small><h3>{article.title}</h3><p>{article.excerpt}</p><Link className="news-read-link" to={`/noticias/${article.slug}`} aria-label={`Abrir matéria: ${article.title}`}>Ler notícia</Link></article>)}
      </div></section>

      {otherArticles.length>0&&<section id="noticias" className="all-news-section"><div className="portal-section-title"><h2>Outras notícias</h2></div><div className="all-news-grid">{otherArticles.map(article=><article className="all-news-card" key={article.id}><Link to={`/noticias/${article.slug}`} aria-label={`Abrir matéria: ${article.title}`}>{article.coverImageUrl?<img src={article.coverImageUrl} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="480" height="270"/>:<div className="news-placeholder">MaterPlace</div>}<span>{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p></Link></article>)}</div></section>}

      <section className="newsletter-card"><div><BookOpen /><span><strong>Receba conteúdos exclusivos para uma maternidade mais leve</strong><small>Artigos, dicas e novidades direto no seu e-mail.</small></span></div><form onSubmit={event => event.preventDefault()}><input type="email" placeholder="Seu melhor e-mail" /><button>Quero receber</button></form></section>
      <div className="portal-bottom-grid">
        <section id="podcasts" className="portal-media-section"><div className="portal-section-title"><h2>Podcasts</h2><a href="#podcasts">Ver todos</a></div><article className="podcast-card"><div><Mic2 /><b>Materna em pauta</b><small>EP. 23</small></div><span><strong>Como lidar com a ansiedade na gestação com informação</strong><small>com Psicóloga Juliana Martins</small><button><Play /> Ouvir agora</button></span></article></section>
        <section id="videos" className="portal-media-section"><div className="portal-section-title"><h2>Vídeos em destaque</h2><a href="#videos">Ver todos</a></div><div className="video-cards">{videos.length?videos.slice(0,3).map(video=><article key={video.id}><a href={`https://youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer"><img src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`} alt={`Miniatura do vídeo: ${video.title}`} loading="lazy" decoding="async" width="480" height="360"/><Play/></a><strong>{video.title}</strong></article>):['Alongamento na gravidez','Como escolher a melhor chupeta','Banho de ofurô'].map((title,index)=><article key={title}><div>{index===0?'🤰':index===1?'👶':'🛁'}<Play/></div><strong>{title}</strong></article>)}</div></section>
      </div>
      <section className="professional-cta"><div><span>Para profissionais</span><h2>Quer divulgar seu trabalho e organizar sua clínica?</h2><p>Conheça o Marketplace + CRM + ERP da MaterPlace.</p></div><Link className="btn btn-primary" to="/para-profissionais">Conhecer a plataforma <ChevronRight /></Link></section>
    </main><LegalFooter />
  </div>
}
