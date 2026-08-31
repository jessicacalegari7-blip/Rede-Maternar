import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { Seo } from '../../components/Seo'
import { listDirectoryFallback, listDirectoryFallbackByCity, searchProfessionalDirectory, searchProfessionalDirectoryByCity, type DirectoryProfessional } from '../../lib/operations'
import { directoryProfilePath } from '../../lib/directorySeo'
import { listPortalArticles, type PortalArticle } from '../../lib/news'
import { LegalFooter } from './Legal'

const titleCase=(value:string)=>value.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()

export function DirectoryLanding(){
  const {specialty='',uf='',city=''}=useParams()
  const [params,setParams]=useSearchParams()
  const page=Math.max(1,Number(params.get('pagina')||1))
  const [rows,setRows]=useState<DirectoryProfessional[]>([])
  const [fallback,setFallback]=useState<DirectoryProfessional[]>([])
  const [news,setNews]=useState<PortalArticle[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const pageSize=20
  const specialtyName=titleCase(specialty)
  const cityName=titleCase(city)
  const state=uf.toUpperCase()
  const locationLabel=[cityName,state].filter(Boolean).join(' - ')

  useEffect(()=>{
    setError('');setLoading(true)
    const directory=uf?searchProfessionalDirectory(specialty,uf,city,page,pageSize):searchProfessionalDirectoryByCity(specialty,city,page,pageSize)
    const alternatives=uf?listDirectoryFallback(specialty,uf,city):listDirectoryFallbackByCity(specialty,city)
    Promise.all([directory,alternatives,listPortalArticles(12)])
      .then(([found,nearby,articles])=>{setRows(found);setFallback(nearby);setNews(articles)})
      .catch(e=>setError(e instanceof Error?e.message:'Não foi possível carregar o diretório.'))
      .finally(()=>setLoading(false))
  },[specialty,uf,city,page])

  const total=Number(rows[0]?.total_count||0)
  const pages=Math.max(1,Math.ceil(total/pageSize))
  const emptyResultArticles=useMemo(()=>{
    const terms=normalize(specialtyName).split(/[^a-z0-9]+/).filter(term=>term.length>2)
    return [...news].sort((a,b)=>{
      const score=(article:PortalArticle)=>{
        const searchable=normalize(`${article.category} ${article.title} ${article.excerpt}`)
        return terms.reduce((total,term)=>total+(searchable.includes(term)?1:0),0)
      }
      const affinity=score(b)-score(a)
      if(affinity!==0)return affinity
      return new Date(b.publishedAt||b.createdAt||0).getTime()-new Date(a.publishedAt||a.createdAt||0).getTime()
    }).slice(0,6)
  },[news,specialtyName])
  const schema=useMemo(()=>[
    {'@context':'https://schema.org','@type':'ItemList',name:`${specialtyName} em ${cityName}`,numberOfItems:total,itemListElement:rows.map((professional,index)=>({'@type':'ListItem',position:(page-1)*pageSize+index+1,url:`https://materplace.com.br${directoryProfilePath(professional)}`,name:professional.name}))},
    {'@context':'https://schema.org','@type':'FAQPage',mainEntity:[{'@type':'Question',name:`Como encontrar ${specialtyName} em ${cityName}?`,acceptedAnswer:{'@type':'Answer',text:'Consulte os perfis disponíveis na MaterPlace e confira localização e informações profissionais declaradas.'}},{'@type':'Question',name:`Quais profissionais estão cadastrados em ${cityName}?`,acceptedAnswer:{'@type':'Answer',text:`A lista é atualizada conforme novos perfis de ${specialtyName} são incluídos e verificados pela plataforma.`}}]},
  ],[specialtyName,cityName,total,rows,page])

  const newsCard=(article:PortalArticle,label='Conteúdo MaterPlace')=><article className="directory-news-card"><Link to={`/noticias/${article.slug}`}>{article.coverImageUrl&&<img src={article.coverImageUrl} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="480" height="270"/>}<span>{label}</span><h3>{article.title}</h3>{article.excerpt&&<p>{article.excerpt}</p>}</Link></article>

  return <div className="marketplace-page">
    <Seo appendBrand={false} title={`${specialtyName} em ${cityName} - ${state} | Encontre Especialistas na MaterPlace`} description={`Procurando ${specialtyName} em ${cityName}? Encontre profissionais qualificados, consulte registros profissionais informados e conheça os perfis disponíveis na MaterPlace.`} schema={schema}/>
    <header className="portal-topbar"><Link to="/"><Logo/></Link><Link className="btn btn-secondary" to="/cadastro-profissional">Cadastre-se</Link></header>
    <main className="directory-shell">
      <header className="directory-hero"><span className="badge">Diretório MaterPlace</span><h1>{specialtyName} em {cityName}, {state}</h1><p>Encontre profissionais de {specialtyName} em {locationLabel}. Confira sempre o registro no conselho de classe antes de contratar um atendimento.</p></header>
      {error&&<div className="alert alert-error">{error}</div>}
      {loading?<section className="card empty-state" aria-label="Carregando diretório"><h2>Carregando profissionais e conteúdos...</h2></section>:<section className="directory-grid">{rows.map((professional,index)=><div className="directory-result-group" key={professional.id}><article className="directory-card"><div className="directory-avatar">{professional.name.split(' ').slice(0,2).map(word=>word[0]).join('')}</div><div><h2>{professional.name}</h2><strong>{professional.primary_specialty}</strong><p><MapPin/> {[professional.neighborhood,professional.city,professional.state_code].filter(Boolean).join(' · ')}</p><small>Dados de contato protegidos</small></div><Link className="btn btn-secondary" to={directoryProfilePath(professional)}>Ver perfil</Link></article>{(index+1)%4===0&&news[index%news.length]&&newsCard(news[index%news.length])}</div>)}</section>}
      {!loading&&rows.length>0&&rows.length<4&&news[0]&&newsCard(news[0],'Leia também')}
      {!loading&&!rows.length&&!error&&<section className="card empty-state"><Search/><h2>Esta especialidade e região ainda estão em fase de validação de cadastros pelo corpo técnico da MaterPlace.</h2><p>Novos profissionais serão incluídos conforme a verificação das fontes e dos cadastros.</p><Link className="btn btn-primary" to="/cadastro-profissional">É profissional ou clínica? Cadastre-se</Link></section>}
      {!loading&&!rows.length&&!error&&emptyResultArticles.length>0&&<section className="directory-empty-news" aria-labelledby="directory-empty-news-title"><div><span>Conteúdo MaterPlace</span><h2 id="directory-empty-news-title">Enquanto isso, veja estas matérias</h2><p>Selecionamos conteúdos relacionados à especialidade pesquisada e as publicações mais recentes do portal.</p></div><div className="directory-empty-news-grid">{emptyResultArticles.map(article=><article className="directory-news-card" key={`empty-news-${article.id}`}><Link to={`/noticias/${article.slug}`}>{article.coverImageUrl?<img src={article.coverImageUrl} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="480" height="270"/>:<div className="news-placeholder">MaterPlace</div>}<span><small>{article.category}</small><strong>{article.title}</strong><em>Ler matéria</em></span></Link></article>)}</div></section>}
      {!loading&&!rows.length&&fallback.length>0&&<section><h2>Profissionais em outras cidades</h2><div className="directory-grid">{fallback.map(professional=><article className="directory-card" key={professional.id}><div><h3>{professional.name}</h3><p>{professional.primary_specialty} · {professional.city}/{professional.state_code}</p></div><Link to={directoryProfilePath(professional)}>Ver perfil</Link></article>)}</div></section>}
      {pages>1&&<nav className="directory-pagination" aria-label="Paginação">{Array.from({length:pages},(_,index)=>index+1).map(number=><button className={number===page?'active':''} key={number} onClick={()=>setParams({pagina:String(number)})}>{number}</button>)}</nav>}
      <section className="directory-faq"><h2>Perguntas frequentes</h2><h3>Como encontrar {specialtyName} em {cityName}?</h3><p>Abra o perfil e confira as informações públicas. Antes do atendimento, valide o registro no conselho profissional competente.</p><h3>Como um profissional entra no diretório?</h3><p>O profissional pode criar ou reivindicar seu perfil e completar os dados na MaterPlace.</p></section>
    </main><LegalFooter/>
  </div>
}
