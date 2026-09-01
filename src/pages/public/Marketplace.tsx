import { FormEvent, useEffect, useState } from 'react'
import { BadgeCheck, CheckCircle2, Crown, Heart, MapPin, MessageCircle, Search, Star, Users } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { CityAutocomplete, useDirectorySpecialties } from '../../components/DirectorySearchFields'
import { listMarketplaceProfessionals, listNearbyMarketplaceProfessionals } from '../../lib/operations'
import { listPortalArticles, type PortalArticle } from '../../lib/news'
import { LegalFooter } from './Legal'
import { Seo } from '../../components/Seo'

export function Marketplace() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState('')
  const [articles,setArticles]=useState<PortalArticle[]>([])
  const [nearby,setNearby]=useState<any[]>([])
  const [nearbyLoading,setNearbyLoading]=useState(false)
  const specialty = params.get('especialidade') || ''
  const city = params.get('cidade') || ''
  const directorySpecialties = useDirectorySpecialties(specialty)

  useEffect(() => { listMarketplaceProfessionals().then(setRows).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível carregar profissionais.'));listPortalArticles(20).then(setArticles).catch(()=>undefined) }, [])
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  const specialtyMatches=(candidate:string,requested:string)=>{
    const left=normalize(candidate); const right=normalize(requested)
    if(left===right)return true
    let common=0; while(common<left.length&&common<right.length&&left[common]===right[common])common+=1
    return common>=7
  }
  const visible = rows.filter(p => (!specialty || (p.specialties || []).some((item:string)=>specialtyMatches(item,specialty))) && (!city || `${p.city}, ${p.state_code}`.toLocaleLowerCase().includes(city.toLocaleLowerCase())))
  useEffect(()=>{
    if(!specialty||!city||visible.length){setNearby([]);return}
    let active=true;setNearbyLoading(true)
    listNearbyMarketplaceProfessionals(specialty,city).then(data=>{if(active)setNearby(data)}).catch(()=>{if(active)setNearby([])}).finally(()=>{if(active)setNearbyLoading(false)})
    return()=>{active=false}
  },[specialty,city,visible.length])
  const displayed=visible.length?visible:nearby
  const specialtyTerms=normalize(specialty).split('-').filter(term=>term.length>3)
  const articleAffinity=(article:PortalArticle)=>{
    if(!specialtyTerms.length)return 0
    const searchable=normalize(`${article.category} ${article.title} ${article.excerpt}`)
    return specialtyTerms.reduce((score,term)=>score+(searchable.includes(term)?1:0),0)
  }
  const relatedArticles=[...articles]
    .sort((left,right)=>articleAffinity(right)-articleAffinity(left)||(Date.parse(right.publishedAt||right.createdAt)-Date.parse(left.publishedAt||left.createdAt)))
    .filter((article,index,all)=>all.findIndex(candidate=>candidate.id===article.id)===index)
  const emptyResultArticles=relatedArticles.slice(0,6)
  const newsCard=(article:PortalArticle,keyPrefix:string)=><article className="directory-news-card" key={`${keyPrefix}-${article.id}`}><Link to={`/noticias/${article.slug}`}><img src={article.coverImageUrl||'/brand/materplace-logo.webp'} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="480" height="270"/><span><small>Conteúdo recomendado · {article.category}</small><strong>{article.title}</strong><em>Ler matéria</em></span></Link></article>
  const newsSection=(start:number,keyPrefix:string)=><section className="directory-empty-news directory-results-news" aria-label="Matérias recomendadas"><div><span>Conteúdo MaterPlace</span><h2>Leia também</h2><p>Conteúdos relacionados à sua busca e as publicações mais recentes do portal.</p></div><div className="directory-empty-news-grid">{relatedArticles.slice(start,start+6).map(article=>newsCard(article,keyPrefix))}</div></section>
  const publicProfileHref=(p:any)=>p.directory_profile
    ? `/profissional/${normalize(p.full_name)}-${p.id}`
    : `/perfil/${p.id}`

  function searchProfessionals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const fields = [['name', 'nome'], ['phone', 'telefone'], ['specialty', 'especialidade'], ['city', 'cidade']] as const
    if (fields.some(([field]) => !String(form.get(field) || '').trim())) { window.alert('Preencha seu nome, telefone, especialidade e cidade para realizar a busca.'); return }
    const query = new URLSearchParams()
    fields.forEach(([field, parameter]) => query.set(parameter, String(form.get(field))))
    navigate(`/profissionais?${query.toString()}`)
  }

  function openWhatsApp(p: any) {
    if (!p.whatsapp) return
    const digits = String(p.whatsapp).replace(/\D/g, '')
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent('Olá! Encontrei seu perfil na MaterPlace e gostaria de mais informações.')}`, '_blank', 'noopener,noreferrer')
  }

  return <div className="marketplace-page">
    <Seo title="Encontre profissionais materno-infantis" description="Busque profissionais materno-infantis por especialidade e cidade. Confira perfis e informações profissionais na MaterPlace." path="/profissionais" index={!specialty&&!city}/>
    <header className="portal-topbar"><Link to="/" aria-label="Início"><Logo /></Link><Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link></header>
    <section className="portal-search">
      <span className="brand-manifesto">Conecta · Acolhe · Transforma</span>
      <h1>Encontre a profissional <em>materno-infantil mais próxima de você</em></h1><p>Busque por especialidade e localização.</p>
      <form onSubmit={searchProfessionals}>
        <label><span>Seu Nome</span><input name="name" defaultValue={params.get('nome') || ''} placeholder="Ex.: Maria Silva" /></label>
        <label><span>Seu Telefone</span><input name="phone" defaultValue={params.get('telefone') || ''} placeholder="Ex.: (11) 99999-9999" /></label>
        <label><span>Especialidade</span><select name="specialty" defaultValue={specialty}><option value="">Escolha uma especialidade</option>{directorySpecialties.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="city-field"><span>Cidade</span><CityAutocomplete defaultValue={city} /></label>
        <button className="portal-search-button"><Search /> Buscar agora</button>
      </form>
      <div className="patient-search-note"><Heart /> Paciente, insira seu nome e telefone e faça sua busca por profissionais gratuitamente.</div>
    </section>
    <main className="marketplace-results-shell"><section className="marketplace-list" style={{ gridColumn: '1 / -1' }}><div className="results-head"><div><h2>{displayed.length} perfis reais encontrados</h2><p className="muted">{!visible.length&&nearby.length?'Não encontramos nesta cidade. Veja profissionais em um raio de até 30 km.':'Somente perfis ativos e publicados.'}</p></div></div>{error && <div className="alert alert-error">{error}</div>}
      {displayed.flatMap((p,index)=>{const premium=p.plan&&p.plan!=='free';const cards:any[]=[<article className={`professional-result-card${premium?' premium-result-card':''}`} key={p.id}><div className="professional-photo wine">{p.profile_image_url?<img src={p.profile_image_url} alt={`Foto de ${p.full_name}`} loading="lazy" width="96" height="110"/>:String(p.full_name).split(' ').slice(0, 2).map((x: string) => x[0]).join('')}</div><div className="professional-result-main"><div className="profile-status-row">{premium&&<span className="premium-profile-badge"><Crown/> Perfil Premium</span>}{p.verified&&<span className="verified-profile-badge"><BadgeCheck/> Perfil verificado</span>}</div><div className="verified-name"><h2>{p.full_name}</h2>{p.verified && <CheckCircle2 />}</div>{p.clinic_name && <p className="clinic-name">{p.clinic_name}</p>}<h3>{(p.specialties || []).join(' · ') || 'Especialidade em atualização'}</h3><div className="rating-line"><Star fill="currentColor" /><strong>{Number(p.rating || 0).toFixed(1)}</strong><span>{p.review_count || 0} avaliações</span></div><div className="location-line"><MapPin /><span>{p.neighborhood ? `${p.neighborhood} · ` : ''}{p.city}, {p.state_code}</span>{p.distance_km!=null&&<span>Aproximadamente {Number(p.distance_km).toFixed(1)} km</span>}<span>Endereço protegido</span></div></div><aside className="professional-result-action">{p.whatsapp ? <button className="btn whatsapp-btn" onClick={() => openWhatsApp(p)}><MessageCircle /> Falar no WhatsApp</button> : <span className="muted">Contato disponível após reivindicação do perfil</span>}<Link className="btn btn-secondary" to={publicProfileHref(p)}>Ver perfil</Link></aside></article>];if(displayed.length>3&&(index+1)%3===0)cards.push(newsSection(index+1,`inline-news-${index}`));return cards})}
      {displayed.length>0&&relatedArticles.length>0&&newsSection(displayed.length>3?Math.ceil(displayed.length/3)*6:0,'final-news')}
      {!displayed.length && !error && !nearbyLoading && <><div className="card empty-state"><Search /><h3>Profissionais em validação</h3><p className="muted">Esta especialidade e região ainda estão em fase de validação dos cadastros dos profissionais pelo corpo técnico da MaterPlace. Tente novamente em breve.</p></div>{emptyResultArticles.length>0&&<section className="directory-empty-news" aria-labelledby="directory-empty-news-title"><div><span>Conteúdo MaterPlace</span><h2 id="directory-empty-news-title">Enquanto isso, veja estas matérias</h2><p>{specialty&&emptyResultArticles.some(article=>articleAffinity(article)>0)?`Selecionamos conteúdos relacionados à busca por ${specialty}.`:'Selecionamos as publicações mais recentes do portal.'}</p></div><div className="directory-empty-news-grid">{emptyResultArticles.map(article=><article className="directory-news-card" key={`empty-news-${article.id}`}><Link to={`/noticias/${article.slug}`}>{article.coverImageUrl?<img src={article.coverImageUrl} alt={`Capa: ${article.title}`} loading="lazy" decoding="async" width="480" height="270"/>:<div className="news-placeholder">MaterPlace</div>}<span><small>{article.category}</small><strong>{article.title}</strong><em>Ler matéria</em></span></Link></article>)}</div></section>}</>}
      {nearbyLoading&&<div className="card empty-state"><Search/><h3>Buscando profissionais próximos...</h3><p className="muted">Estamos consultando um raio de até 30 km.</p></div>}
    </section></main><LegalFooter />
  </div>
}
