import { ArrowLeft, CalendarDays, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getPortalArticle, type PortalArticle } from '../../lib/wordpress'
import { LegalFooter } from './Legal'

export function PortalArticlePage() {
  const { id = '' } = useParams()
  const [article, setArticle] = useState<PortalArticle | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { window.scrollTo(0, 0); void getPortalArticle(id).then(setArticle).catch(error => setError(error instanceof Error ? error.message : 'Não foi possível carregar esta notícia.')) }, [id])

  return <div className="portal-home">
    <header className="portal-topbar article-topbar">
      <Link to="/" aria-label="Início"><Logo /></Link>
      <Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link>
      <div className="portal-header-actions"><Link to="/profissionais" aria-label="Buscar profissionais"><Search /></Link></div>
    </header>
    <nav className="article-nav"><Link to="/"><ArrowLeft /> Voltar para o Portal MaterPlace</Link><Link to="/profissionais">Buscar profissionais</Link></nav>
    <main className="article-page">
      {error && <div className="alert alert-error">{error}</div>}
      {!article && !error && <div className="card empty-state">Carregando notícia...</div>}
      {article && <article>
        <header className="article-heading"><span>{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><small><CalendarDays /> {new Date(article.date).toLocaleDateString('pt-BR')}</small></header>
        {article.image && <img className="article-cover" src={article.image} alt="" />}
        <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />
      </article>}
      <aside className="article-marketplace-cta"><div><strong>Precisa de apoio materno-infantil?</strong><p>Encontre profissionais e clínicas na sua região.</p></div><Link className="btn btn-primary" to="/profissionais">Buscar profissionais</Link></aside>
    </main>
    <LegalFooter />
  </div>
}
