import { FormEvent, useEffect, useState } from 'react'
import { CheckCircle2, Heart, MapPin, MessageCircle, Search, Star, Users } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { maternalChildSpecialties } from '../../data/specialties'
import { listMarketplaceProfessionals } from '../../lib/operations'
import { LegalFooter } from './Legal'

export function Marketplace() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState('')
  const specialty = params.get('especialidade') || ''
  const city = params.get('cidade') || ''

  useEffect(() => { listMarketplaceProfessionals().then(setRows).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível carregar profissionais.')) }, [])
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
  const specialtyMatches=(candidate:string,requested:string)=>{
    const left=normalize(candidate); const right=normalize(requested)
    if(left===right)return true
    let common=0; while(common<left.length&&common<right.length&&left[common]===right[common])common+=1
    return common>=7
  }
  const visible = rows.filter(p => (!specialty || (p.specialties || []).some((item:string)=>specialtyMatches(item,specialty))) && (!city || `${p.city}, ${p.state_code}`.toLocaleLowerCase().includes(city.toLocaleLowerCase())))
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
    <header className="portal-topbar"><Link to="/" aria-label="Início"><Logo /></Link><Link className="professional-access" to="/login"><span><Users /></span><strong>Profissional de Saúde<small>Login na plataforma</small></strong></Link></header>
    <section className="portal-search">
      <span className="brand-manifesto">Conecta · Acolhe · Transforma</span>
      <h1>Encontre a profissional <em>materno-infantil mais próxima de você</em></h1><p>Busque por especialidade e localização.</p>
      <form onSubmit={searchProfessionals}>
        <label><span>Seu Nome</span><input name="name" defaultValue={params.get('nome') || ''} placeholder="Ex.: Maria Silva" /></label>
        <label><span>Seu Telefone</span><input name="phone" defaultValue={params.get('telefone') || ''} placeholder="Ex.: (11) 99999-9999" /></label>
        <label><span>Especialidade</span><select name="specialty" defaultValue={specialty}><option value="">Escolha uma especialidade</option>{maternalChildSpecialties.map(item => <option key={item}>{item}</option>)}</select></label>
        <label><span>Cidade</span><input name="city" defaultValue={city} placeholder="Ex.: São Paulo, SP" /></label>
        <button className="portal-search-button"><Search /> Buscar agora</button>
      </form>
      <div className="patient-search-note"><Heart /> Paciente, insira seu nome e telefone e faça sua busca por profissionais gratuitamente.</div>
    </section>
    <main className="marketplace-results-shell"><section className="marketplace-list" style={{ gridColumn: '1 / -1' }}><div className="results-head"><div><h2>{visible.length} perfis reais encontrados</h2><p className="muted">Somente perfis ativos e publicados.</p></div></div>{error && <div className="alert alert-error">{error}</div>}
      {visible.map(p => <article className="professional-result-card" key={p.id}><div className="professional-photo wine">{String(p.full_name).split(' ').slice(0, 2).map((x: string) => x[0]).join('')}</div><div className="professional-result-main"><div className="verified-name"><h2>{p.full_name}</h2>{p.verified && <><CheckCircle2 /><span>Perfil verificado</span></>}</div>{p.clinic_name && <p className="clinic-name">{p.clinic_name}</p>}<h3>{(p.specialties || []).join(' · ') || 'Especialidade em atualização'}</h3><div className="rating-line"><Star fill="currentColor" /><strong>{Number(p.rating || 0).toFixed(1)}</strong><span>{p.review_count || 0} avaliações</span></div><div className="location-line"><MapPin /><span>{p.neighborhood ? `${p.neighborhood} · ` : ''}{p.city}, {p.state_code}</span><span>Endereço protegido</span></div></div><aside className="professional-result-action">{p.whatsapp ? <button className="btn whatsapp-btn" onClick={() => openWhatsApp(p)}><MessageCircle /> Falar no WhatsApp</button> : <span className="muted">Contato disponível após reivindicação do perfil</span>}<Link className="btn btn-secondary" to={publicProfileHref(p)}>Ver perfil</Link></aside></article>)}
      {!visible.length && !error && <div className="card empty-state"><Search /><h3>Profissionais em validação</h3><p className="muted">Esta especialidade e região ainda estão em fase de validação dos cadastros dos profissionais pelo corpo técnico da MaterPlace. Tente novamente em breve.</p></div>}
    </section></main><LegalFooter />
  </div>
}
