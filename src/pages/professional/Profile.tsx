import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Eye, Plus, Save, Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { getUsers } from '../../lib/auth'
import { isClinicPlan } from '../../lib/plans'
import {
  getProfileByUserId,
  makeDefaultProfile,
  modeLabels,
  saveProfile,
  weekdayLabels,
  type AttendanceMode,
  type ProfessionalProfile,
  type ProfessionalService,
} from '../../lib/professionalProfile'

const emptyService = (): ProfessionalService => ({
  id: crypto.randomUUID(), name: '', description: '', durationMinutes: 60, price: 0, modes: ['office'], active: true,
})

export function ProfessionalProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [tab, setTab] = useState<'profile' | 'services' | 'availability'>('profile')
  const [message, setMessage] = useState('')
  const clinicAccount = isClinicPlan(user?.plan)

  useEffect(() => {
    if (!user) return
    const fullUser = getUsers().find((item) => item.id === user.id)
    setProfile(getProfileByUserId(user.id) ?? makeDefaultProfile(user.id, user.name, fullUser?.specialty, fullUser?.city, fullUser?.registration))
  }, [user])

  const completion = useMemo(() => {
    if (!profile) return 0
    const fields = [profile.displayName, profile.headline, profile.specialty, profile.city, profile.about, profile.phone]
    const completed = fields.filter(Boolean).length + (profile.services.length ? 1 : 0)
    return Math.round((completed / 7) * 100)
  }, [profile])

  if (!profile) return null

  function update<K extends keyof ProfessionalProfile>(key: K, value: ProfessionalProfile[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current)
  }

  function persist() {
    if (!profile) return
    saveProfile(profile)
    setMessage('Alterações salvas com sucesso.')
    window.setTimeout(() => setMessage(''), 2500)
  }

  function updateService(id: string, patch: Partial<ProfessionalService>) {
    update('services', profile.services.map((service) => service.id === id ? { ...service, ...patch } : service))
  }

  function toggleMode(service: ProfessionalService, mode: AttendanceMode) {
    const modes = service.modes.includes(mode) ? service.modes.filter((item) => item !== mode) : [...service.modes, mode]
    updateService(service.id, { modes })
  }

  return <>
    <div className="page-heading profile-heading">
      <div><h1>{clinicAccount ? 'Perfis da clínica no Marketplace' : 'Meu perfil no Marketplace'}</h1><p className="muted">{clinicAccount ? 'Gerencie todos os profissionais publicados pela clínica.' : 'Mantenha seus dados, especialidades e disponibilidade atualizados.'}</p></div>
      <div className="heading-actions">
        <a className="btn btn-secondary" href={`/perfil/${profile.slug}`} target="_blank" rel="noreferrer"><Eye size={17}/> Ver perfil público</a>
        <button className="btn btn-primary" onClick={persist}><Save size={17}/> Salvar alterações</button>
      </div>
    </div>

    {message && <div className="alert alert-success"><Check size={17}/>{message}</div>}

    {clinicAccount && <section className="card clinic-marketplace-profiles"><div className="section-heading"><div><h2>Profissionais publicados</h2><p className="muted">No Marketplace, o nome da profissional aparece em destaque e a clínica logo abaixo.</p></div><button className="btn btn-primary"><Plus size={17}/> Cadastrar profissional</button></div><div className="grid grid-3">{[['Dra. Marina Lopes','Consultoria em amamentação'],['Dra. Camila Rocha','Pediatria'],['Fernanda Alves','Psicologia perinatal']].map(([name,specialty])=><article className="marketplace-profile-mini" key={name}><div className="avatar">{name.split(' ').slice(0,2).map(x=>x[0])}</div><div><strong>{name}</strong><span>Clínica Cuidar Materno</span><small>{specialty}</small></div><button className="btn btn-secondary btn-small">Editar</button></article>)}</div></section>}

    {!clinicAccount && <div className="specialty-limit-note"><strong>Perfil individual · até 3 especialidades</strong><span>Você utiliza 1 de 3 especialidades disponíveis. Esta conta não permite cadastrar outros profissionais.</span></div>}

    <div className="profile-progress card">
      <div><strong>Seu perfil está {completion}% completo</strong><p className="muted">Perfis completos transmitem mais confiança para pacientes e parceiros.</p></div>
      <div className="progress-track"><span style={{ width: `${completion}%` }}/></div>
    </div>

    <div className="tabs">
      <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Apresentação</button>
      <button className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>Serviços</button>
      <button className={tab === 'availability' ? 'active' : ''} onClick={() => setTab('availability')}>Disponibilidade</button>
    </div>

    {tab === 'profile' && <div className="grid grid-2 profile-editor-grid">
      <section className="card form-section">
        <h2>Informações principais</h2>
        <div className="field"><label>Nome profissional</label><input value={profile.displayName} onChange={(event) => update('displayName', event.target.value)} /></div>
        <div className="field"><label>Título de apresentação</label><textarea rows={3} value={profile.headline} onChange={(event) => update('headline', event.target.value)} placeholder="Uma frase clara sobre seu trabalho e diferencial." /></div>
        <div className="form-grid">
          <div className="field"><label>{clinicAccount ? 'Especialidade principal' : 'Especialidade 1 de 3'}</label><input value={profile.specialty} onChange={(event) => update('specialty', event.target.value)} /></div>
          <div className="field"><label>Registro profissional</label><input value={profile.registration} onChange={(event) => update('registration', event.target.value)} /></div>
          <div className="field"><label>Cidade</label><input value={profile.city} onChange={(event) => update('city', event.target.value)} /></div>
          <div className="field"><label>Anos de experiência</label><input type="number" min="0" value={profile.yearsExperience} onChange={(event) => update('yearsExperience', Number(event.target.value))} /></div>
        </div>
        <div className="field"><label>Sobre você</label><textarea rows={7} value={profile.about} onChange={(event) => update('about', event.target.value)} placeholder="Conte sobre sua abordagem, experiência e forma de cuidar." /></div>
      </section>
      <section className="card form-section">
        <h2>Contato e visibilidade</h2>
        <div className="field"><label>Telefone profissional</label><input value={profile.phone} onChange={(event) => update('phone', event.target.value)} /></div>
        <div className="field"><label>Instagram</label><input value={profile.instagram} onChange={(event) => update('instagram', event.target.value)} placeholder="@seuperfil" /></div>
        <div className="field"><label>Site</label><input value={profile.website} onChange={(event) => update('website', event.target.value)} placeholder="https://" /></div>
        <div className="field"><label>Endereço do perfil</label><div className="slug-input"><span>redematernar.com/perfil/</span><input value={profile.slug} onChange={(event) => update('slug', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}/></div></div>
        <label className="switch-card"><div><strong>Aceitando novas pacientes</strong><span className="muted">Exibe disponibilidade no seu perfil público.</span></div><input type="checkbox" checked={profile.acceptsNewPatients} onChange={(event) => update('acceptsNewPatients', event.target.checked)}/><span className="switch"/></label>
      </section>
    </div>}

    {tab === 'services' && <section className="card">
      <div className="section-heading"><div><h2>Serviços oferecidos</h2><p className="muted">Cadastre o que a paciente poderá escolher ao agendar.</p></div><button className="btn btn-primary" onClick={() => update('services', [...profile.services, emptyService()])}><Plus size={17}/> Novo serviço</button></div>
      <div className="service-editor-list">
        {profile.services.length === 0 && <div className="empty-state"><h3>Nenhum serviço cadastrado</h3><p className="muted">Adicione sua primeira modalidade de atendimento.</p></div>}
        {profile.services.map((service, index) => <article className="service-editor" key={service.id}>
          <div className="service-number">{index + 1}</div>
          <div className="service-fields">
            <div className="form-grid">
              <div className="field"><label>Nome do serviço</label><input value={service.name} onChange={(event) => updateService(service.id, { name: event.target.value })}/></div>
              <div className="field"><label>Duração</label><select value={service.durationMinutes} onChange={(event) => updateService(service.id, { durationMinutes: Number(event.target.value) })}>{[30,40,45,60,75,90,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></div>
              <div className="field field-span-2"><label>Descrição</label><textarea rows={3} value={service.description} onChange={(event) => updateService(service.id, { description: event.target.value })}/></div>
              <div className="field"><label>Valor</label><div className="money-input"><span>R$</span><input type="number" min="0" step="10" value={service.price} onChange={(event) => updateService(service.id, { price: Number(event.target.value) })}/></div></div>
              <div className="field"><label>Modalidades</label><div className="choice-row">{(Object.keys(modeLabels) as AttendanceMode[]).map((mode) => <button type="button" key={mode} className={service.modes.includes(mode) ? 'choice active' : 'choice'} onClick={() => toggleMode(service, mode)}>{modeLabels[mode]}</button>)}</div></div>
            </div>
          </div>
          <div className="service-actions"><label className="mini-toggle"><input type="checkbox" checked={service.active} onChange={(event) => updateService(service.id, { active: event.target.checked })}/><span>{service.active ? 'Ativo' : 'Inativo'}</span></label><button className="icon-btn reject" title="Excluir serviço" onClick={() => update('services', profile.services.filter((item) => item.id !== service.id))}><Trash2 size={17}/></button></div>
        </article>)}
      </div>
    </section>}

    {tab === 'availability' && <section className="card">
      <div className="section-heading"><div><h2>Disponibilidade semanal</h2><p className="muted">Defina os períodos gerais. Os horários específicos serão configurados no módulo Agenda.</p></div></div>
      <div className="availability-list">{profile.availability.map((day) => <div className={`availability-row ${day.enabled ? '' : 'disabled'}`} key={day.weekday}>
        <label className="day-check"><input type="checkbox" checked={day.enabled} onChange={(event) => update('availability', profile.availability.map((item) => item.weekday === day.weekday ? { ...item, enabled: event.target.checked } : item))}/><strong>{weekdayLabels[day.weekday]}</strong></label>
        {day.enabled ? <div className="time-range"><input type="time" value={day.start} onChange={(event) => update('availability', profile.availability.map((item) => item.weekday === day.weekday ? { ...item, start: event.target.value } : item))}/><span>até</span><input type="time" value={day.end} onChange={(event) => update('availability', profile.availability.map((item) => item.weekday === day.weekday ? { ...item, end: event.target.value } : item))}/></div> : <span className="muted">Indisponível</span>}
      </div>)}</div>
    </section>}
  </>
}
