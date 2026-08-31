import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin, ShieldCheck } from 'lucide-react'
import { Logo } from '../../components/Logo'
import { Seo } from '../../components/Seo'
import { directoryProfilePath } from '../../lib/directorySeo'
import { getDirectoryProfessional, type DirectoryProfessional } from '../../lib/operations'
import { LegalFooter } from './Legal'

const medicalSlug=(value:string)=>/(pediatr|medic|ginecolog|obstetr|neurolog|cardiolog)/i.test(value)

export function DirectoryProfile(){
  const {profileSlug='',slug=''}=useParams()
  const routeSlug=profileSlug||slug
  const id=routeSlug.match(/([0-9a-f]{8}-[0-9a-f-]{27})$/i)?.[1]||''
  const [row,setRow]=useState<DirectoryProfessional|null>()
  useEffect(()=>{if(id)getDirectoryProfessional(id).then(setRow).catch(()=>setRow(null));else setRow(null)},[id])

  const canonical=row?directoryProfilePath(row):window.location.pathname
  const schema=useMemo(()=>{
    if(!row)return undefined
    const result:Record<string,unknown>={
      '@context':'https://schema.org',
      '@type':medicalSlug(row.specialty_slug)?'Physician':'MedicalBusiness',
      name:row.name,
      medicalSpecialty:row.primary_specialty,
      url:`https://materplace.com.br${directoryProfilePath(row)}`,
      address:{'@type':'PostalAddress',addressLocality:row.city,addressRegion:row.state_code,addressCountry:'BR',...(row.neighborhood?{addressNeighborhood:row.neighborhood}:{})},
    }
    return result
  },[row])

  if(row===undefined)return <div className="auth-page">Carregando perfil...</div>
  if(!row)return <div className="auth-page"><div className="auth-card"><Logo/><h1>Perfil não encontrado</h1><Link to="/">Voltar ao início</Link></div></div>
  const premium=row.is_claimed&&row.plan_type==='premium'
  const description=`${row.name}, ${row.primary_specialty} em ${row.neighborhood?`${row.neighborhood}, `:''}${row.city}/${row.state_code}. Consulte as informações profissionais disponíveis na MaterPlace.`

  return <div className="clinic-profile-page">
    <Seo title={`${row.name} - ${row.primary_specialty} em ${row.city}`} description={description} path={canonical} schema={schema}/>
    <header className="portal-topbar compact"><Link to="/"><Logo/></Link></header>
    <main className="clinic-profile-shell"><section className="card directory-profile-card">
      <ShieldCheck/><h1>{row.name}</h1><h2>{row.primary_specialty}</h2>
      <p><MapPin/> {[row.neighborhood,row.city,row.state_code].filter(Boolean).join(' · ')}</p>
      <p className="directory-trust-note">Informações obtidas de cadastro próprio ou fontes públicas. Confirme o registro no conselho profissional competente antes do atendimento.</p>
      {premium?<p>Perfil Premium reivindicado e administrado pelo responsável.</p>:<div className="claim-profile"><h2>Este perfil ainda não foi reivindicado</h2><p>Por privacidade, telefone, WhatsApp, e-mail e endereço completo não são exibidos.</p><Link className="btn btn-primary" to="/cadastro-profissional">É responsável por este perfil? Reivindique agora</Link></div>}
    </section></main><LegalFooter/>
  </div>
}
