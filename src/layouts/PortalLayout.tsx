import type { ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarDays, Home, KanbanSquare,
  Bell, LogOut, MessageCircle, Search, Settings, ShieldCheck, Sparkles, UserRound, Users, Video, Wallet,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import type { UserRole } from '../lib/types'
import { useAuth } from '../lib/AuthContext'

type Item = [string, string, ComponentType<{ size?: string | number }>]

const menus: Partial<Record<UserRole, Item[]>> = {
  patient: [
    ['Início', '/paciente', Home],
    ['Conversas', '/paciente/conversas', MessageCircle],
    ['Agendamentos', '/paciente/agendamentos', CalendarDays],
    ['Pagamentos', '/paciente/pagamentos', Wallet],
    ['Perfil e privacidade', '/paciente/perfil', Settings],
  ],
  admin: [
    ['Dashboard', '/admin', Home],
    ['Profissionais', '/admin/profissionais', ShieldCheck],
    ['Cadastros', '/admin/usuarios', Users],
    ['Agendamentos', '/admin/agendamentos', CalendarDays],
    ['Financeiro', '/admin/financeiro', BadgeDollarSign],
    ['Central do backoffice', '/admin/operacao', BriefcaseBusiness],
    ['Configurações', '/admin/configuracoes', Settings],
  ],
}

const management: Item[] = [
  ['Visão geral', '/profissional', Home],
  ['Funil CRM', '/profissional/funil', KanbanSquare],
  ['Clientes', '/profissional/clientes', Users],
  ['Caixa de entrada', '/profissional/conversas', MessageCircle],
  ['Integrações e canais', '/profissional/integracoes', Bell],
  ['Agenda', '/profissional/agenda', CalendarDays],
  ['Teleconsultas', '/profissional/teleconsultas', Video],
  ['Serviços', '/profissional/servicos', BriefcaseBusiness],
  ['Financeiro ERP', '/profissional/financeiro', Wallet],
  ['Relatórios', '/profissional/relatorios', BarChart3],
  ['Equipe da clínica', '/profissional/equipe', Users],
  ['Perfil no Marketplace', '/profissional/perfil', UserRound],
  ['Meu plano', '/profissional/plano', Sparkles],
]

const marketplace: Item[] = [
  ['Desempenho do perfil', '/profissional', Home],
  ['Explorar Marketplace', '/profissional/rede', Search],
  ['Meu perfil', '/profissional/perfil', UserRound],
  ['Meu plano', '/profissional/plano', Sparkles],
]

const labels: Record<UserRole, string> = {
  patient: 'Paciente',
  professional: 'Profissional',
  admin: 'Administração',
}

export function PortalLayout({ role }: { role: UserRole }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = role === 'professional'
    ? (user?.plan === 'business' ? management : marketplace)
    : (menus[role] ?? [])
  const planLabel = user?.plan === 'business'
    ? 'Gestão Completa'
    : user?.plan === 'marketplace' ? 'Marketplace Ilimitado' : 'Marketplace Gratuito'

  function signOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return <div className="shell">
    <aside className="sidebar">
      <Logo />
      <div className="sidebar-user">
        <div className="avatar avatar-light">{user?.name.split(' ').slice(0, 2).map(part => part[0]).join('')}</div>
        <div><strong>{user?.name}</strong><small>{role === 'professional' ? planLabel : labels[role]}</small></div>
      </div>
      <nav className="nav">{items.map(([label, to, Icon]) =>
        <NavLink key={to} to={to} end={to.split('/').length === 2}><Icon size={18} />{label}</NavLink>,
      )}</nav>
      <button className="sidebar-logout" onClick={signOut}><LogOut size={18} />Sair</button>
    </aside>
    <main className="main"><Outlet /></main>
    <nav className="mobile-bar">
      {items.slice(0, 4).map(([label, to, Icon]) =>
        <NavLink key={to} to={to} end={to.split('/').length === 2}><Icon size={20} /><span>{label}</span></NavLink>,
      )}
      <button onClick={signOut}><LogOut size={20} /><span>Sair</span></button>
    </nav>
  </div>
}
