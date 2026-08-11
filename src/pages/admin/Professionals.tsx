import { useEffect, useMemo, useState } from 'react'
import { Check, RefreshCw, Search, ShieldBan, X } from 'lucide-react'
import type { UserStatus } from '../../lib/auth'
import {
  listAdminProfessionals,
  setAdminProfessionalPlan,
  setAdminProfessionalStatus,
  type AdminProfessional,
} from '../../lib/adminProfessionals'

const statusLabels: Record<UserStatus, string> = {
  active: 'Aprovada',
  pending: 'Aguardando análise',
  suspended: 'Suspensa',
  rejected: 'Rejeitada',
}

export function AdminProfessionals() {
  const [professionals, setProfessionals] = useState<AdminProfessional[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changingId, setChangingId] = useState('')

  async function loadProfessionals() {
    setLoading(true)
    setError('')
    try {
      setProfessionals(await listAdminProfessionals())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os cadastros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfessionals()
  }, [])

  const filtered = useMemo(() => professionals.filter((professional) => {
    const content = [
      professional.fullName,
      professional.email,
      professional.specialty,
      professional.city,
      professional.organizationName,
    ].join(' ').toLowerCase()
    return content.includes(search.toLowerCase()) && (filter === 'all' || professional.status === filter)
  }), [professionals, search, filter])

  async function changeStatus(id: string, status: UserStatus) {
    setChangingId(id)
    setError('')
    try {
      await setAdminProfessionalStatus(id, status)
      await loadProfessionals()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Não foi possível alterar o cadastro.')
    } finally {
      setChangingId('')
    }
  }

  async function changePlan(organizationId:string,plan:AdminProfessional['plan']) {
    setChangingId(organizationId)
    setError('')
    try { await setAdminProfessionalPlan(organizationId,plan); await loadProfessionals() }
    catch (planError) { setError(planError instanceof Error?planError.message:'Não foi possível alterar o plano.') }
    finally { setChangingId('') }
  }

  return <div>
    <div className="page-heading">
      <div>
        <h1>Profissionais</h1>
        <p className="muted">Cadastros reais armazenados no Supabase.</p>
      </div>
      <div className="row">
        <span className="badge">{professionals.filter((item) => item.status === 'pending').length} aguardando análise</span>
        <button className="icon-btn" title="Atualizar" onClick={() => void loadProfessionals()} disabled={loading}>
          <RefreshCw size={18}/>
        </button>
      </div>
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="card filter-bar">
      <div className="search-field"><Search size={18}/><input placeholder="Buscar por nome, e-mail, clínica ou especialidade" value={search} onChange={(event) => setSearch(event.target.value)}/></div>
      <select value={filter} onChange={(event) => setFilter(event.target.value as UserStatus | 'all')}>
        <option value="all">Todos os status</option>
        <option value="pending">Aguardando análise</option>
        <option value="active">Aprovadas</option>
        <option value="suspended">Suspensas</option>
        <option value="rejected">Rejeitadas</option>
      </select>
    </div>
    {loading && <div className="card empty-state"><RefreshCw/><h3>Carregando cadastros reais…</h3></div>}
    <div className="professionals-list">
      {filtered.map((professional) => <article className="card professional-row" key={professional.userId}>
        <div className="row">
          <div className="avatar">{professional.fullName.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div>
          <div>
            <strong>{professional.fullName}</strong>
            <p className="muted compact">{professional.specialty} · {professional.city || 'Cidade não informada'}</p>
            <small>{professional.email} · {professional.organizationType === 'clinic' ? 'Clínica' : 'Profissional independente'}</small>
          </div>
        </div>
        <div className="professional-meta">
          <span className={`status status-${professional.status}`}>{statusLabels[professional.status]}</span>
          <small>Cadastro em {new Date(professional.createdAt).toLocaleDateString('pt-BR')}</small>
          <strong>{professional.viewCount} visualizações do perfil</strong>
        </div>
        <div className="action-buttons">
          <select value={professional.plan} disabled={changingId===professional.organizationId} onChange={event=>void changePlan(professional.organizationId,event.target.value as AdminProfessional['plan'])} aria-label="Alterar plano">
            <option value="free">Gratuito</option><option value="marketplace">Marketplace</option><option value="independent">Individual CRM + ERP</option><option value="clinic">Clínicas</option>
          </select>
          {professional.status !== 'active' && <button disabled={changingId === professional.userId} className="icon-btn approve" title="Aprovar" onClick={() => void changeStatus(professional.userId, 'active')}><Check size={18}/></button>}
          {professional.status !== 'rejected' && <button disabled={changingId === professional.userId} className="icon-btn reject" title="Rejeitar" onClick={() => void changeStatus(professional.userId, 'rejected')}><X size={18}/></button>}
          {professional.status === 'active' && <button disabled={changingId === professional.userId} className="icon-btn suspend" title="Suspender" onClick={() => void changeStatus(professional.userId, 'suspended')}><ShieldBan size={18}/></button>}
        </div>
      </article>)}
      {!loading && !filtered.length && <div className="card empty-state"><h3>Nenhum cadastro encontrado</h3><p className="muted">Tente alterar a busca ou o filtro.</p></div>}
    </div>
  </div>
}
