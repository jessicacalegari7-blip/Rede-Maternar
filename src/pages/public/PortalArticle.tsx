import { ArrowLeft, CalendarDays, Facebook, Instagram, MessageCircle, Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { getPortalArticle, listPortalArticles, type PortalArticle } from '../../lib/news'
import { LegalFooter } from './Legal'
import { WebPushPrompt } from '../../components/WebPushPrompt'

export function PortalArticlePage() {
  const navigate = useNavigate()
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

  useEffect(() => {
    if (!article) return
    const canonical=`https://www.materplace.com.br/noticias/${article.slug}`
    const image=article.coverImageUrl||'https://www.materplace.com.br/brand/materplace-logo.png'
    document.title=article.seoTitle||article.title
    const setMeta=(key:string,value:string,attribute='name')=>{let element=document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement|null;if(!element){element=document.createElement('meta');element.setAttribute(attribute,key);document.head.appendChild(element)}element.content=value}
    setMeta('robots','index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1')
    ;[['og:title',article.title],['og:description',article.excerpt],['og:image',image],['og:url',canonical],['og:type','article']].forEach(([key,value])=>setMeta(key,value,'property'))
    ;[['twitter:card','summary_large_image'],['twitter:title',article.title],['twitter:description',article.excerpt],['twitter:image',image]].forEach(([key,value])=>setMeta(key,value))
    let link=document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement|null;if(!link){link=document.createElement('link');link.rel='canonical';document.head.appendChild(link)}link.href=canonical
    document.getElementById('article-jsonld')?.remove();const script=document.createElement('script');script.id='article-jsonld';script.type='application/ld+json';script.text=JSON.stringify({'@context':'https://schema.org','@type':'NewsArticle',headline:article.title,image:[image],datePublished:article.publishedAt||article.createdAt,dateModified:article.publishedAt||article.createdAt,author:{'@type':'Person',name:article.authorName},publisher:{'@type':'Organization',name:'MaterPlace',url:'https://www.materplace.com.br',logo:{'@type':'ImageObject',url:'https://www.materplace.com.br/brand/materplace-logo.png'}},mainEntityOfPage:canonical});document.head.appendChild(script)
    return()=>{script.remove()}
  },[article])

  function returnToHomeTop() {
    navigate('/')
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
    window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 50)
  }

  function renderContent() {
    if(!article)return null
    const blocks=article.content.split(/\n\s*\n/).filter(Boolean)
    let paragraphs=0;let relatedIndex=0
    const related=[...suggestions.filter(item=>item.category===article.category),...suggestions.filter(item=>item.category!==article.category)]
    return blocks.flatMap((block,index)=>{const rendered=renderBlock(block,index);const isParagraph=!/^(##|###|- |> |!\[|\[youtube:)/.test(block);if(!isParagraph)return[rendered];paragraphs++;if(paragraphs===2)return[rendered,<aside className="ebook-article-ad" aria-label="Publicidade: Guia prático e completo de amamentação" key={`ebook-${index}`}><span>Publicidade</span><a href="https://pay.kiwify.com.br/l3UKxyE" target="_blank" rel="sponsored noreferrer" aria-label="Comprar o Guia prático e completo de amamentação"><img src="/brand/ebook-amamentacao.png" alt="Guia prático e completo de amamentação, da gestação aos primeiros meses do bebê" loading="lazy" decoding="async" width="1600" height="900"/></a></aside>];if(paragraphs===3||(paragraphs>3&&(paragraphs-3)%5===0)){const item=related[relatedIndex++%Math.max(related.length,1)];if(item)return[rendered,<aside className="inline-related-posts" role="complementary" aria-label="Leia também" key={`related-${index}`}><Link className="inline-related-card" to={`/noticias/${item.slug}`} title={item.title}>{item.coverImageUrl?<img src={item.coverImageUrl} alt={`Capa: ${item.title}`} loading="lazy" decoding="async" width="240" height="135"/>:<span className="inline-related-placeholder">MaterPlace</span>}<span className="inline-related-copy"><small>LEIA TAMBÉM · {item.category}</small><strong>{item.title}</strong></span></Link></aside>]}return[rendered]})
  }

  function inline(text:string){return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[grande\].+?\[\/grande\]|\[pequeno\].+?\[\/pequeno\]|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).filter(Boolean).map((part,i)=>{const bold=part.match(/^\*\*(.+)\*\*$/);if(bold)return <strong key={i}>{bold[1]}</strong>;const italic=part.match(/^\*(.+)\*$/);if(italic)return <em key={i}>{italic[1]}</em>;if(part.startsWith('[grande]'))return <span className="text-large" key={i}>{part.slice(8,-9)}</span>;if(part.startsWith('[pequeno]'))return <span className="text-small" key={i}>{part.slice(9,-10)}</span>;const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);if(link)return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;return part})}
  function renderBlock(block:string,index:number){const h3=block.match(/^###\s+(.+)$/);if(h3)return <h3 key={index}>{inline(h3[1])}</h3>;const h2=block.match(/^##\s+(.+)$/);if(h2)return <h2 key={index}>{inline(h2[1])}</h2>;const image=block.match(/^!\[(.*?)\]\((https?:\/\/[^)]+)\)$/);if(image)return <figure key={index}><img src={image[2]} alt={image[1]||"Imagem ilustrativa da matéria"} loading="lazy" decoding="async" width="1200" height="675"/>{image[1]&&<figcaption>{image[1]}</figcaption>}</figure>;const youtube=block.match(/^\[youtube:([A-Za-z0-9_-]{11})\]$/);if(youtube)return <div className="article-youtube" key={index}><iframe loading="lazy" src={`https://www.youtube-nocookie.com/embed/${youtube[1]}`} title="Vídeo do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>;const lines=block.split('\n');if(lines.every(x=>x.startsWith('- ')))return <ul key={index}>{lines.map((x,i)=><li key={i}>{inline(x.slice(2))}</li>)}</ul>;if(block.startsWith('> '))return <blockquote key={index}>{inline(block.slice(2))}</blockquote>;return <p key={index}>{inline(block)}</p>}

  return <div className="portal-home">
    <header className="portal-topbar article-topbar">
      <Link to="/" aria-label="Início e topo da página"><Logo /></Link>
      <Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link>
      <div className="portal-header-actions"><Link to="/profissionais" aria-label="Buscar profissionais"><Search /></Link></div>
    </header>
    <nav className="article-nav"><Link to="/" onClick={() => window.scrollTo({ top: 0 })}><ArrowLeft /> Voltar para o Portal MaterPlace</Link><button type="button" onClick={returnToHomeTop}>Buscar profissionais</button></nav>
    <main className="article-layout">
      <section className="article-page">
        {error && <div className="alert alert-error">{error}</div>}
        {!article && !error && <div className="card empty-state">Carregando notícia...</div>}
        {article && <article>
          <header className="article-heading"><span>{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><small><CalendarDays /> {new Date(article.publishedAt || article.createdAt).toLocaleDateString('pt-BR')} · {article.authorName}</small></header>
          {article.coverImageUrl && <img className="article-cover" src={article.coverImageUrl} alt={`Imagem de capa: ${article.title}`} width="1600" height="900" decoding="async" />}
          <div className="article-share" aria-label="Compartilhar matéria"><strong>Compartilhar:</strong><a href={`https://wa.me/?text=${encodeURIComponent(`${article.title} https://materplace.com.br/noticias/${article.slug}`)}`} target="_blank" rel="noreferrer"><MessageCircle/>WhatsApp</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://materplace.com.br/noticias/${article.slug}`)}`} target="_blank" rel="noreferrer"><Facebook/>Facebook</a><a className="instagram-follow" href="https://www.instagram.com/materplace/" target="_blank" rel="noreferrer" aria-label="Seguir a MaterPlace no Instagram"><Instagram/>Siga @materplace</a></div><div className="article-content">{renderContent()}</div>
          {article.isDemo && <div className="demo-content-note">Conteúdo demonstrativo para composição inicial do portal. Será substituído gradualmente por publicações editoriais da MaterPlace.</div>}
        </article>}
        <aside className="article-marketplace-cta"><div><strong>Precisa de apoio materno-infantil?</strong><p>Encontre profissionais e clínicas na sua região.</p></div><button className="btn btn-primary" type="button" onClick={returnToHomeTop}>Buscar profissionais</button></aside>
      </section>
      <aside className="article-suggestions"><span>Continue lendo</span><h2>Matérias sugeridas</h2>{suggestions.map((item, index) => <Link to={`/noticias/${item.slug}`} key={item.id}>{item.coverImageUrl?<img className="suggestion-art" src={item.coverImageUrl} alt={`Capa: ${item.title}`} loading="lazy" width="164" height="152"/>:<div className={`suggestion-art suggestion-${index + 1}`}>{['🤱','👶','🩺','💗'][index]}</div>}<small>{item.category}</small><strong>{item.title}</strong><em>Ler matéria</em></Link>)}</aside>
    </main>
    {article&&<WebPushPrompt category={article.category}/>}<LegalFooter />
  </div>
}
