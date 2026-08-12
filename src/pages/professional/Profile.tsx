import { useEffect, useState } from 'react'
import { Eye, Save } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getMyProfessionalProfile, getProfessionalSpecialtyEditor, listMyProfileViewCounts, saveProfessionalSpecialties, updateMyProfessionalProfile, uploadMarketplaceImage, type RealProfessionalProfile } from '../../lib/operations'
import { isClinicPlan } from '../../lib/plans'

export function ProfessionalProfilePage() {
  const { user } = useAuth()
  const [profile,setProfile]=useState<RealProfessionalProfile|null>(null)
  const [specialtyOptions,setSpecialtyOptions]=useState<string[]>([])
  const [selectedSpecialties,setSelectedSpecialties]=useState<string[]>([])
  const [viewCount,setViewCount]=useState(0)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')
  const specialtyLimit=isClinicPlan(user?.plan)?null:3

  useEffect(()=>{void getMyProfessionalProfile().then(async loaded=>{
    if(!loaded) throw new Error('Perfil profissional não encontrado.')
    setProfile(loaded)
    const specialties=await getProfessionalSpecialtyEditor(loaded.id)
    setSpecialtyOptions(specialties.options.map(item=>item.name)); setSelectedSpecialties(specialties.selected)
    const counts=await listMyProfileViewCounts(); setViewCount(Number(counts.find(item=>item.professional_id===loaded.id)?.view_count??0))
  }).catch(e=>setError(e.message))},[])

  if(error) return <div className="card"><h2>Não foi possível carregar o perfil</h2><p>{error}</p></div>
  if(!profile) return <div className="card"><p>Carregando perfil real...</p></div>
  const set=<K extends keyof RealProfessionalProfile>(key:K,value:RealProfessionalProfile[K])=>setProfile({...profile,[key]:value})
  const list=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean)
  const upload=async(kind:'profile'|'cover'|'gallery',files:FileList|null)=>{
    if(!files?.length)return
    setNotice('Enviando imagem...')
    try{
      const urls=await Promise.all(Array.from(files).map(file=>uploadMarketplaceImage(file,kind)))
      if(kind==='profile')set('profile_image_url',urls[0]); if(kind==='cover')set('cover_image_url',urls[0]); if(kind==='gallery')set('gallery_urls',[...(profile.gallery_urls||[]),...urls])
      setNotice('Imagem enviada. Clique em Salvar perfil real para confirmar.')
    }catch(e){setNotice(e instanceof Error?e.message:'Erro ao enviar imagem.')}
  }
  const save=async()=>{
    setNotice('')
    try{await updateMyProfessionalProfile(profile.id,{...profile,profile_completed:Boolean(profile.full_name&&profile.city&&profile.whatsapp)});await saveProfessionalSpecialties(profile.id,selectedSpecialties,specialtyLimit);setNotice('Perfil salvo no banco de dados.')}
    catch(e){setNotice(e instanceof Error?e.message:'Erro ao salvar.')}
  }

  return <div>
    <div className="page-heading"><div><h1>Perfil no Marketplace</h1><p>Cadastre aqui todos os dados públicos da clínica ou profissional.</p><strong>{viewCount} visualizações deste perfil</strong></div><a className="btn btn-secondary" href={`/perfil/${profile.id}`} target="_blank" rel="noreferrer"><Eye size={17}/>Ver perfil</a></div>
    {notice&&<div className="notice">{notice}</div>}
    <section className="card grid grid-2 profile-editor-grid">
      <div className="field"><label>Foto do perfil ou logotipo</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload('profile',e.target.files)}/>{profile.profile_image_url&&<img src={profile.profile_image_url} alt="Perfil" style={{maxWidth:160,borderRadius:16,marginTop:10}}/>}</div>
      <div className="field"><label>Imagem de capa</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void upload('cover',e.target.files)}/>{profile.cover_image_url&&<img src={profile.cover_image_url} alt="Capa" style={{width:'100%',maxHeight:150,objectFit:'cover',borderRadius:16,marginTop:10}}/>}</div>
      <div className="field"><label>Nome da profissional</label><input value={profile.full_name} onChange={e=>set('full_name',e.target.value)}/></div>
      <div className="field"><label>Nome da clínica</label><input value={profile.clinic_name||''} onChange={e=>set('clinic_name',e.target.value)}/></div>
      <div className="field"><label>Registro profissional</label><input value={profile.professional_registration||''} onChange={e=>set('professional_registration',e.target.value)}/></div>
      <div className="field"><label>WhatsApp</label><input value={profile.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)}/></div>
      <div className="field"><label>E-mail profissional</label><input type="email" value={profile.email||''} onChange={e=>set('email',e.target.value)}/></div>
      <div className="field"><label>Instagram</label><input value={profile.instagram_handle||''} onChange={e=>set('instagram_handle',e.target.value)}/></div>
      <div className="field"><label>Site</label><input value={profile.website_url||''} onChange={e=>set('website_url',e.target.value)}/></div>
      <div className="field"><label>Cidade</label><input value={profile.city} onChange={e=>set('city',e.target.value)}/></div>
      <div className="field"><label>UF</label><input maxLength={2} value={profile.state_code} onChange={e=>set('state_code',e.target.value.toUpperCase())}/></div>
      <div className="field"><label>Bairro</label><input value={profile.neighborhood||''} onChange={e=>set('neighborhood',e.target.value)}/></div>
      <div className="field"><label>CEP</label><input value={profile.postal_code||''} onChange={e=>set('postal_code',e.target.value)}/></div>
      <div className="field"><label>Endereço</label><input value={profile.address_line||''} onChange={e=>set('address_line',e.target.value)}/></div>
      <div className="field"><label>Número</label><input value={profile.address_number||''} onChange={e=>set('address_number',e.target.value)}/></div>
      <div className="field"><label>Complemento</label><input value={profile.address_complement||''} onChange={e=>set('address_complement',e.target.value)}/></div>
      <div className="field"><label>Horários de atendimento</label><input value={profile.opening_hours||''} onChange={e=>set('opening_hours',e.target.value)}/></div>
      <div className="field grid-span-2"><label>Especialidades {specialtyLimit===null?'(ilimitadas)':`(${selectedSpecialties.length} de ${specialtyLimit})`}</label><div className="specialty-picker">{specialtyOptions.map(name=>{const selected=selectedSpecialties.includes(name);const disabled=!selected&&specialtyLimit!==null&&selectedSpecialties.length>=specialtyLimit;return <label className={`specialty-choice ${selected?'selected':''}`} key={name}><input type="checkbox" checked={selected} disabled={disabled} onChange={()=>setSelectedSpecialties(current=>selected?current.filter(item=>item!==name):[...current,name])}/><span>{name}</span></label>})}</div></div>
      <div className="field grid-span-2"><label>Apresentação profissional</label><textarea rows={5} value={profile.bio||''} onChange={e=>set('bio',e.target.value)}/></div>
      <div className="field grid-span-2"><label>Sobre a clínica ou consultório</label><textarea rows={5} value={profile.clinic_description||''} onChange={e=>set('clinic_description',e.target.value)}/></div>
      <div className="field"><label>Convênios (separados por vírgula)</label><input value={(profile.accepted_insurances||[]).join(', ')} onChange={e=>set('accepted_insurances',list(e.target.value))}/></div>
      <div className="field"><label>Formas de pagamento</label><input value={(profile.payment_methods||[]).join(', ')} onChange={e=>set('payment_methods',list(e.target.value))}/></div>
      <div className="field grid-span-2"><label>Vídeo do consultório (link do YouTube)</label><input type="url" value={profile.office_video_url||''} onChange={e=>set('office_video_url',e.target.value)}/></div>
      <div className="field grid-span-2"><label>Fotos do consultório</label><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>void upload('gallery',e.target.files)}/><small>{(profile.gallery_urls||[]).length} foto(s) enviada(s)</small></div>
      <label className="switch-card"><span><strong>Aceita atendimento online</strong></span><input type="checkbox" checked={profile.accepts_online} onChange={e=>set('accepts_online',e.target.checked)}/></label>
      <div className="switch-card"><span><strong>Publicação no Marketplace</strong><small>{profile.marketplace_visible?'Perfil aprovado e publicado.':'Aguardando aprovação da administração.'}</small></span></div>
      <button className="btn btn-primary grid-span-2" onClick={()=>void save()}><Save size={17}/>Salvar perfil real</button>
    </section>
  </div>
}
