import { ArrowLeft, CalendarDays, Search, Users } from 'lucide-react'
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
          {article.coverImageUrl && <img className="article-cover" src={article.coverImageUrl} alt="" />}
          <div className="article-content">{article.content.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          {article.isDemo && <div className="demo-content-note">Conteúdo demonstrativo para composição inicial do portal. Será substituído gradualmente por publicações editoriais da MaterPlace.</div>}
        </article>}
        <aside className="article-marketplace-cta"><div><strong>Precisa de apoio materno-infantil?</strong><p>Encontre profissionais e clínicas na sua região.</p></div><Link className="btn btn-primary" to="/profissionais">Buscar profissionais</Link></aside>
      </section>
      <aside className="article-suggestions"><span>Continue lendo</span><h2>Matérias sugeridas</h2>{suggestions.map((item, index) => <Link to={`/noticias/${item.slug}`} key={item.id}><div className={`suggestion-art suggestion-${index + 1}`}>{['🤱','👶','🩺','💗'][index]}</div><small>{item.category}</small><strong>{item.title}</strong><em>Ler matéria</em></Link>)}</aside>
    </main>
    <LegalFooter />
  </div>
}
