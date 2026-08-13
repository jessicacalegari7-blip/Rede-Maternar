import { ArrowLeft, CalendarDays, Facebook, Instagram, MessageCircle, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getPortalArticle, listPortalArticles, type PortalArticle } from '../../lib/news'
import { LegalFooter } from './Legal'

export function PortalArticlePage() {
  const { slug = '' } = useParams()
  const [article, setArticle] = useState<PortalArticle | null>(null)
  const [suggestions, setSuggestions] = useState<PortalArticle[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
    setArticle(null); setError('')
    void Promise.all([getPortalArticle(slug), listPortalArticles(10)])
      .then(([current, all]) => { setArticle(current); setSuggestions(all.filter(item => item.slug !== current.slug).slice(0, 4)) })
      .catch(error => setError(error instanceof Error ? error.message : 'Não foi possível carregar esta notícia.'))
  }, [slug])

  function renderBlock(block:string,index:number){const h3=block.match(/^###\s+(.+)$/);if(h3)return <h3 key={index}>{h3[1]}</h3>;const h2=block.match(/^##\s+(.+)$/);if(h2)return <h2 key={index}>{h2[1]}</h2>;const image=block.match(/^!\[(.*?)\]\((https?:\/\/[^)]+)\)$/);if(image)return <figure key={index}><img src={image[2]} alt={image[1]||"Imagem ilustrativa da matéria"} loading="lazy" decoding="async" width="1200" height="675"/>{image[1]&&<figcaption>{image[1]}</figcaption>}</figure>;const youtube=block.match(/^\[youtube:([A-Za-z0-9_-]{11})\]$/);if(youtube)return <div className="article-youtube" key={index}><iframe loading="lazy" src={`https://www.youtube-nocookie.com/embed/${youtube[1]}`} title="Vídeo do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>;return <p key={index}>{block}</p>}

  return <div className="portal-home">
    <header className="portal-topbar article-topbar">
      <Link to="/" aria-label="Início"><Logo /></Link>
      <Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link>
      <div className="portal-header-actions"><Link to="/profissionais" aria-label="Buscar profissionais"><Search /></Link></div>
    </header>
    <nav className="article-nav"><Link to="/"><ArrowLeft /> Voltar para o Portal MaterPlace</Link><Link to="/profissionais">Buscar profissionais</Link></nav>
    <main className="article-layout">
      <section className="article-page">
        {error && <div className="alert alert-error">{error}</div>}
        {!article && !error && <div className="card empty-state">Carregando notícia...</div>}
        {article && <article>
          <header className="article-heading"><span>{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><small><CalendarDays /> {new Date(article.publishedAt || article.createdAt).toLocaleDateString('pt-BR')} · {article.authorName}</small></header>
          {article.coverImageUrl && <img className="article-cover" src={article.coverImageUrl} alt={`Imagem de capa: ${article.title}`} width="1600" height="900" decoding="async" />}
          <div className="article-share" aria-label="Compartilhar matéria"><strong>Compartilhar:</strong><a href={`https://wa.me/?text=${encodeURIComponent(`${article.title} https://materplace.com.br/noticias/${article.slug}`)}`} target="_blank" rel="noreferrer"><MessageCircle/>WhatsApp</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://materplace.com.br/noticias/${article.slug}`)}`} target="_blank" rel="noreferrer"><Facebook/>Facebook</a><button onClick={async()=>{await navigator.clipboard.writeText(`https://materplace.com.br/noticias/${article.slug}`);window.open("https://www.instagram.com/","_blank")}}><Instagram/>Instagram</button></div><div className="article-content">{article.content.split(/\n\s*\n/).filter(Boolean).map(renderBlock)}</div>
          {article.isDemo && <div className="demo-content-note">Conteúdo demonstrativo para composição inicial do portal. Será substituído gradualmente por publicações editoriais da MaterPlace.</div>}
        </article>}
        <aside className="article-marketplace-cta"><div><strong>Precisa de apoio materno-infantil?</strong><p>Encontre profissionais e clínicas na sua região.</p></div><Link className="btn btn-primary" to="/">Buscar profissionais</Link></aside>
      </section>
      <aside className="article-suggestions"><span>Continue lendo</span><h2>Matérias sugeridas</h2>{suggestions.map((item, index) => <Link to={`/noticias/${item.slug}`} key={item.id}>{item.coverImageUrl?<img className="suggestion-art" src={item.coverImageUrl} alt={`Capa: ${item.title}`} loading="lazy" width="164" height="152"/>:<div className={`suggestion-art suggestion-${index + 1}`}>{['🤱','👶','🩺','💗'][index]}</div>}<small>{item.category}</small><strong>{item.title}</strong><em>Ler matéria</em></Link>)}</aside>
    </main>
    <LegalFooter />
  </div>
}
