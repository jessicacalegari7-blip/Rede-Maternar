import { useMemo, useState } from 'react'
import { Check, Search, ShieldBan, X } from 'lucide-react'
import { getUsers, updateUserStatus, type AppUser, type UserStatus } from '../../lib/auth'

const statusLabels: Record<UserStatus, string> = {
  active: 'Aprovada', pending: 'Aguardando análise', suspended: 'Suspensa', rejected: 'Rejeitada',
}

export function AdminProfessionals() {
  const [professionals, setProfessionals] = useState<AppUser[]>(() => getUsers().filter((user) => user.role === 'professional'))
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserStatus | 'all'>('all')

  const filtered = useMemo(() => professionals.filter((professional) => {
    const content = `${professional.name} ${professional.email} ${professional.specialty} ${professional.city}`.toLowerCase()
    return content.includes(search.toLowerCase()) && (filter === 'all' || professional.status === filter)
  }), [professionals, search, filter])

  function changeStatus(id: string, status: UserStatus) {
    updateUserStatus(id, status)
    setProfessionals(getUsers().filter((user) => user.role === 'professional'))
  }

  return <div>
    <div className="page-heading"><div><h1>Profissionais</h1><p className="muted">Analise cadastros e controle o acesso à Rede Maternar.</p></div><span className="badge">{professionals.filter((item) => item.status === 'pending').length} aguardando análise</span></div>
    <div className="card filter-bar"><div className="search-field"><Search size={18}/><input placeholder="Buscar por nome, e-mail ou especialidade" value={search} onChange={(event) => setSearch(event.target.value)}/></div><select value={filter} onChange={(event) => setFilter(event.target.value as UserStatus | 'all')}><option value="all">Todos os status</option><option value="pending">Aguardando análise</option><option value="active">Aprovadas</option><option value="suspended">Suspensas</option><option value="rejected">Rejeitadas</option></select></div>
    <div className="professionals-list">
      {filtered.map((professional) => <article className="card professional-row" key={professional.id}>
        <div className="row"><div className="avatar">{professional.name.split(' ').slice(0,2).map((part) => part[0]).join('')}</div><div><strong>{professional.name}</strong><p className="muted compact">{professional.specialty || 'Especialidade não informada'} · {professional.city || 'Cidade não informada'}</p><small>{professional.email}</small></div></div>
        <div className="professional-meta"><span className={`status status-${professional.status}`}>{statusLabels[professional.status]}</span><small>Cadastro em {new Date(professional.createdAt).toLocaleDateString('pt-BR')}</small></div>
        <div className="action-buttons">
          {professional.status !== 'active' && <button className="icon-btn approve" title="Aprovar" onClick={() => changeStatus(professional.id, 'active')}><Check size={18}/></button>}
          {professional.status !== 'rejected' && <button className="icon-btn reject" title="Rejeitar" onClick={() => changeStatus(professional.id, 'rejected')}><X size={18}/></button>}
          {professional.status === 'active' && <button className="icon-btn suspend" title="Suspender" onClick={() => changeStatus(professional.id, 'suspended')}><ShieldBan size={18}/></button>}
        </div>
      </article>)}
      {!filtered.length && <div className="card empty-state"><h3>Nenhum cadastro encontrado</h3><p className="muted">Tente alterar a busca ou o filtro.</p></div>}
    </div>
  </div>
}
