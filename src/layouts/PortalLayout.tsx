import { useEffect, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarDays, Home, KanbanSquare,
  Bell, LogOut, Menu, MessageCircle, Newspaper, Settings, ShieldCheck, Sparkles, UserRound, Users, Video, Wallet, X,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import type { UserRole } from '../lib/types'
import { useAuth } from '../lib/AuthContext'
import { hasManagement, isClinicPlan, planLabels } from '../lib/plans'

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
    ['Notícias do portal', '/admin/noticias', Newspaper],
    ['Central do backoffice', '/admin/operacao', BriefcaseBusiness],
    ['Configurações', '/admin/configuracoes', Settings],
  ],
}

const management: Item[] = [
  ['Visão geral', '/profissional', Home],
  ['Funil CRM', '/profissional/funil', KanbanSquare],
  ['Clientes', '/profissional/clientes', Users],
  ['Integrações e canais', '/profissional/integracoes', Bell],
  ['Agenda', '/profissional/agenda', CalendarDays],
  ['Teleconsultas', '/profissional/teleconsultas', Video],
  ['Serviços', '/profissional/servicos', BriefcaseBusiness],
  ['Financeiro ERP', '/profissional/financeiro', Wallet],
  ['Relatórios', '/profissional/relatorios', BarChart3],
  ['Perfil no Marketplace', '/profissional/perfil', UserRound],
  ['Meu plano', '/profissional/plano', Sparkles],
]

const marketplace: Item[] = [
  ['Perfil no Marketplace', '/profissional/perfil', UserRound],
  ['Serviços do perfil', '/profissional/servicos', BriefcaseBusiness],
  ['Meu plano', '/profissional/plano', Sparkles],
]

const labels: Record<UserRole, string> = {
  patient: 'Paciente',
  professional: 'Profissional',
  admin: 'Administração',
}

export function PortalLayout({ role }: { role: UserRole }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => setMobileMenuOpen(false), [location.pathname])
  const items = role === 'professional'
    ? (hasManagement(user?.plan) ? (isClinicPlan(user?.plan) ? [...management.slice(0,-2), ['Equipe da clínica', '/profissional/equipe', Users] as Item, ...management.slice(-2)] : management) : marketplace)
    : (menus[role] ?? [])
  const planLabel = user?.plan ? planLabels[user.plan] : 'Marketplace Gratuito'

  async function signOut() {
    await logout()
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
      <div className="portal-legal-menu"><Link to="/expediente">Expediente</Link><Link to="/termos">Termos</Link><Link to="/lgpd">LGPD</Link><Link to="/privacidade">Privacidade</Link><Link to="/cookies">Cookies</Link><Link to="/contato">Contato</Link></div><button className="sidebar-logout" onClick={signOut}><LogOut size={18} />Sair</button>
    </aside>
    <main className="main">
      <button className="mobile-menu-trigger" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menu"><Menu /> Menu</button>
      <Outlet />
    </main>
    {mobileMenuOpen && <button className="mobile-menu-backdrop" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
    <aside className={`mobile-navigation${mobileMenuOpen ? ' open' : ''}`} aria-hidden={!mobileMenuOpen}>
      <div className="mobile-navigation-head"><Logo /><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu"><X /></button></div>
      <nav>{items.map(([label, to, Icon]) =>
        <NavLink key={to} to={to} end={to.split('/').length === 2} onClick={() => setMobileMenuOpen(false)}><Icon size={20} /><span>{label}</span></NavLink>,
      )}</nav>
      <button className="mobile-navigation-logout" onClick={signOut}><LogOut size={20} /><span>Sair</span></button>
    </aside>
  </div>
}
