import { useEffect, useState } from 'react'
import { Eye, Save } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getMyProfessionalProfile, getProfessionalSpecialtyEditor, saveProfessionalSpecialties, updateMyProfessionalProfile, type RealProfessionalProfile } from '../../lib/operations'
import { isClinicPlan } from '../../lib/plans'

export function ProfessionalProfilePage() {
  const { user } = useAuth()
  const [profile,setProfile]=useState<RealProfessionalProfile|null>(null)
  const [specialtyOptions,setSpecialtyOptions]=useState<string[]>([])
  const [selectedSpecialties,setSelectedSpecialties]=useState<string[]>([])
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const specialtyLimit=isClinicPlan(user?.plan)?null:3

  useEffect(()=>{void getMyProfessionalProfile().then(async loaded=>{
    setProfile(loaded)
    const specialties=await getProfessionalSpecialtyEditor(loaded.id)
    setSpecialtyOptions(specialties.options.map(item=>item.name))
    setSelectedSpecialties(specialties.selected)
  }).catch(e=>setError(e.message))},[])

  if(error) return <div className="card"><h2>Não foi possível carregar o perfil</h2><p>{error}</p></div>
  if(!profile) return <div className="card"><p>Carregando perfil real...</p></div>
  const set=<K extends keyof RealProfessionalProfile>(key:K,value:RealProfessionalProfile[K])=>setProfile({...profile,[key]:value})
  const list=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean)
  const save=async()=>{
    setNotice('')
    try {
      await updateMyProfessionalProfile(profile.id,{...profile,profile_completed:Boolean(profile.full_name&&profile.city&&profile.whatsapp)})
      await saveProfessionalSpecialties(profile.id,selectedSpecialties,specialtyLimit)
      setNotice('Perfil salvo no banco de dados.')
    } catch(e){setNotice(e instanceof Error?e.message:'Erro ao salvar.')}
  }

  return <div>
    <div className="page-heading"><div><h1>Perfil no Marketplace</h1><p>Estas informações são gravadas no Supabase e exibidas no perfil público.</p></div><a className="btn btn-secondary" href={`/perfil/${profile.id}`} target="_blank" rel="noreferrer"><Eye size={17}/>Ver perfil</a></div>
    {notice&&<div className="notice">{notice}</div>}
    <section className="card grid grid-2 profile-editor-grid">
      <div className="field"><label>Nome da profissional</label><input value={profile.full_name} onChange={e=>set('full_name',e.target.value)}/></div>
      <div className="field"><label>Nome da clínica (se houver)</label><input value={profile.clinic_name||''} onChange={e=>set('clinic_name',e.target.value)}/></div>
      <div className="field"><label>Registro profissional</label><input value={profile.professional_registration||''} onChange={e=>set('professional_registration',e.target.value)}/></div>
      <div className="field"><label>WhatsApp</label><input value={profile.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)}/></div>
      <div className="field"><label>E-mail profissional</label><input type="email" value={profile.email||''} onChange={e=>set('email',e.target.value)}/></div>
      <div className="field"><label>Instagram</label><input value={profile.instagram_handle||''} onChange={e=>set('instagram_handle',e.target.value)}/></div>
      <div className="field"><label>Site</label><input value={profile.website_url||''} onChange={e=>set('website_url',e.target.value)}/></div>
      <div className="field"><label>Cidade</label><input value={profile.city} onChange={e=>set('city',e.target.value)}/></div>
      <div className="field"><label>UF</label><input maxLength={2} value={profile.state_code} onChange={e=>set('state_code',e.target.value.toUpperCase())}/></div>
      <div className="field"><label>Bairro (endereço completo não é público)</label><input value={profile.neighborhood||''} onChange={e=>set('neighborhood',e.target.value)}/></div>
      <div className="field grid-span-2"><label>Especialidades {specialtyLimit===null?'(ilimitadas)':`(${selectedSpecialties.length} de ${specialtyLimit})`}</label>
        <div className="specialty-picker">
          {specialtyOptions.map(name=>{
            const selected=selectedSpecialties.includes(name)
            const disabled=!selected&&specialtyLimit!==null&&selectedSpecialties.length>=specialtyLimit
            return <label className={`specialty-choice ${selected?'selected':''}`} key={name}>
              <input type="checkbox" checked={selected} disabled={disabled} onChange={()=>setSelectedSpecialties(current=>selected?current.filter(item=>item!==name):[...current,name])}/>
              <span>{name}</span>
            </label>
          })}
        </div>
        <small className="muted">{specialtyLimit===null?'O plano Clínicas permite especialidades ilimitadas.':'Este plano permite selecionar até 3 especialidades.'}</small>
      </div>
      <div className="field grid-span-2"><label>Apresentação</label><textarea rows={6} value={profile.bio||''} onChange={e=>set('bio',e.target.value)}/></div>
      <div className="field"><label>Convênios (separados por vírgula)</label><input value={profile.accepted_insurances.join(', ')} onChange={e=>set('accepted_insurances',list(e.target.value))}/></div>
      <div className="field"><label>Formas de pagamento</label><input value={profile.payment_methods.join(', ')} onChange={e=>set('payment_methods',list(e.target.value))}/></div>
      <label className="switch-card"><span><strong>Aceita atendimento online</strong></span><input type="checkbox" checked={profile.accepts_online} onChange={e=>set('accepts_online',e.target.checked)}/></label>
      <label className="switch-card"><span><strong>Publicar no Marketplace</strong></span><input type="checkbox" checked={profile.marketplace_visible} onChange={e=>set('marketplace_visible',e.target.checked)}/></label>
      <button className="btn btn-primary grid-span-2" onClick={()=>void save()}><Save size={17}/>Salvar perfil real</button>
    </section>
  </div>
}
