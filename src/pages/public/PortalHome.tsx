import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserRound } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { listPortalArticles, type PortalArticle } from '../../lib/wordpress'
import { LegalFooter } from './Legal'

export function PortalHome() {
  const [articles,setArticles]=useState<PortalArticle[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('')
  useEffect(()=>{void listPortalArticles().then(setArticles).catch(e=>setError(e instanceof Error?e.message:'Falha ao carregar notícias.')).finally(()=>setLoading(false))},[])
  const [featured,...more]=articles
  return <div className="portal-page"><header className="portal-topbar"><Link to="/"><Logo/></Link><Link className="btn btn-secondary" to="/login"><UserRound/>Profissional de Saúde</Link></header>
    <main className="portal-shell"><section className="portal-search"><div><h1>Encontre profissionais materno-infantis perto de você</h1><p>Consulte somente perfis reais aprovados pela MaterPlace.</p></div><form action="/profissionais"><label><span>Especialidade ou localização</span><input name="busca" placeholder="Ex.: Pediatria em Campinas"/></label><button className="btn btn-gold"><Search/>Buscar profissionais</button></form></section>
      <section className="wordpress-news"><div className="section-heading"><div><span className="badge">Portal MaterPlace</span><h2>Informação para uma jornada mais acolhedora</h2></div></div>
        {loading&&<div className="card empty-state">Carregando notícias...</div>}{error&&<div className="alert alert-error">{error}</div>}
        {featured&&<article className="news-featured">{featured.image&&<img src={featured.image} alt=""/>}<div><span className="badge">{featured.category}</span><h2>{featured.title}</h2><p>{featured.excerpt}</p><small>{new Date(featured.date).toLocaleDateString('pt-BR')}</small><a className="btn btn-primary" href={featured.url} target="_blank" rel="noreferrer">Ler notícia</a></div></article>}
        {!!more.length&&<div className="news-real-grid">{more.map(article=><article className="card" key={article.id}>{article.image&&<img src={article.image} alt=""/>}<span className="badge">{article.category}</span><h3>{article.title}</h3><p>{article.excerpt}</p><a href={article.url} target="_blank" rel="noreferrer">Ler notícia</a></article>)}</div>}
        {!loading&&!error&&!articles.length&&<div className="card empty-state"><h3>Nenhuma notícia publicada</h3></div>}
      </section>
      <section className="card" style={{marginTop:24}}><h2>Você é profissional ou representa uma clínica?</h2><p className="muted">Crie seu cadastro e aguarde a aprovação para aparecer no Marketplace.</p><Link className="btn btn-secondary" to="/para-profissionais">Conhecer os planos</Link></section>
    </main><LegalFooter/></div>
}
