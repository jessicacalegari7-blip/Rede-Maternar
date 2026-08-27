import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Landing } from './pages/public/Landing'
import { PortalHome } from './pages/public/PortalHome'
import { Marketplace } from './pages/public/Marketplace'
import { DirectoryLanding } from './pages/public/DirectoryLanding'
import { DirectoryProfile } from './pages/public/DirectoryProfile'
import { Login } from './pages/public/Login'
import { ProfessionalSignup } from './pages/public/ProfessionalSignup'
import { PublicProfessionalProfile } from './pages/public/PublicProfessionalProfile'
import { PatientInvitation } from './pages/public/PatientInvitation'
import { PortalLayout } from './layouts/PortalLayout'
import { Placeholder } from './pages/Placeholder'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { hasManagement } from './lib/plans'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PlanGate } from './components/PlanGate'
import { SetPassword } from './pages/public/SetPassword'
import { RecoverPassword } from './pages/public/RecoverPassword'
import { AboutPage, ContactPage, CookiePolicy, DisclaimerPage, EditorialStaffPage, LgpdPage, PrivacyPolicy, TermsOfUse } from './pages/public/Legal'
import { PortalArticlePage } from './pages/public/PortalArticle'
import { CookieConsent } from './components/CookieConsent'

const ProfessionalPatients=lazy(()=>import('./pages/professional/Patients').then(m=>({default:m.ProfessionalPatients})))
const ProfessionalProfilePage=lazy(()=>import('./pages/professional/Profile').then(m=>({default:m.ProfessionalProfilePage})))
const CrmCustomers=lazy(()=>import('./pages/professional/Workspace').then(m=>({default:m.CrmCustomers})))
const CrmPipeline=lazy(()=>import('./pages/professional/Workspace').then(m=>({default:m.CrmPipeline})))
const ErpServices=lazy(()=>import('./pages/professional/Workspace').then(m=>({default:m.ErpServices})))
const AdminHome=lazy(()=>import('./pages/admin/Home').then(m=>({default:m.AdminHome})))
const AdminProfessionals=lazy(()=>import('./pages/admin/Professionals').then(m=>({default:m.AdminProfessionals})))
const ProfessionalAgenda=lazy(()=>import('./pages/professional/Agenda').then(m=>({default:m.ProfessionalAgenda})))
const ProfessionalConversations=lazy(()=>import('./pages/professional/Conversations').then(m=>({default:m.ProfessionalConversations})))
const FinanceSuite=lazy(()=>import('./pages/professional/FinanceSuite').then(m=>({default:m.FinanceSuite})))
const ProfessionalPlanPage=lazy(()=>import('./pages/professional/Plan').then(m=>({default:m.ProfessionalPlanPage})))
const AdminOperations=lazy(()=>import('./pages/admin/Backoffice').then(m=>({default:m.AdminOperations})))
const AdminUsers=lazy(()=>import('./pages/admin/Backoffice').then(m=>({default:m.AdminUsers})))
const SocialIntegrations=lazy(()=>import('./pages/professional/SocialIntegrations').then(m=>({default:m.SocialIntegrations})))
const ClinicTeam=lazy(()=>import('./pages/professional/ClinicTeam').then(m=>({default:m.ClinicTeam})))
const AdminNewsPortal=lazy(()=>import('./pages/admin/NewsPortal').then(m=>({default:m.AdminNewsPortal})))

function ProfessionalEntry() {
  const { user } = useAuth()
  return hasManagement(user?.plan)
    ? <Navigate to="/profissional/funil" replace />
    : <Navigate to="/profissional/perfil" replace />
}

function PublicHome() {
  const authType = new URLSearchParams(window.location.hash.slice(1)).get('type')
  if (authType === 'invite' || authType === 'recovery') {
    return <Navigate to={`/definir-senha${window.location.hash}`} replace />
  }
  return <PortalHome />
}

export default function App() {
  return <BrowserRouter><AuthProvider><Suspense fallback={<main className="route-loading" aria-live="polite">Carregando...</main>}><Routes>
    <Route path="/" element={<PublicHome />} />
    <Route path="/categoria/:category" element={<PortalHome />} />
    <Route path="/para-profissionais" element={<Landing />} />
    <Route path="/profissionais" element={<Marketplace />} />
    <Route path="/profissionais/:specialty/:city" element={<DirectoryLanding />} />
    <Route path="/encontrar/:specialty/:uf/:city" element={<DirectoryLanding />} />
    <Route path="/profissional/:slug" element={<DirectoryProfile />} />
    <Route path="/noticias/:slug" element={<PortalArticlePage />} />
    <Route path="/login" element={<Login />} />
    <Route path="/definir-senha" element={<SetPassword />} />
    <Route path="/recuperar-senha" element={<RecoverPassword />} />
    <Route path="/cadastro-profissional" element={<ProfessionalSignup />} />
    <Route path="/privacidade" element={<PrivacyPolicy />} />
    <Route path="/termos" element={<TermsOfUse />} />
    <Route path="/lgpd" element={<LgpdPage />} />
    <Route path="/cookies" element={<CookiePolicy />} />
    <Route path="/contato" element={<ContactPage />} />
    <Route path="/sobre" element={<AboutPage />} />
    <Route path="/expediente" element={<EditorialStaffPage />} />
    <Route path="/isencao-de-responsabilidade" element={<DisclaimerPage />} />
    <Route path="/perfil/:slug" element={<PublicProfessionalProfile />} />
    <Route path="/convite/:token" element={<PatientInvitation />} />

    <Route element={<ProtectedRoute role="patient" />}>
      <Route path="/paciente" element={<PortalLayout role="patient" />}>
        <Route index element={<Placeholder title="Área da paciente" description="O cadastro de pacientes será liberado em uma etapa posterior." />} />
        <Route path="conversas" element={<Placeholder title="Conversas" description="Nenhuma conversa demonstrativa é exibida." />} />
        <Route path="agendamentos" element={<Placeholder title="Agendamentos" description="Nenhum agendamento demonstrativo é exibido." />} />
        <Route path="pagamentos" element={<Placeholder title="Pagamentos" description="Aguardando integração real de pagamentos." />} />
        <Route path="perfil" element={<Placeholder title="Perfil da paciente" description="O cadastro de pacientes será liberado em uma etapa posterior." />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute role="professional" />}>
      <Route path="/profissional" element={<PortalLayout role="professional" />}>
        <Route index element={<ProfessionalEntry />} />
        <Route path="perfil" element={<ProfessionalProfilePage />} />
        <Route path="servicos" element={<ErpServices />} />
        <Route path="plano" element={<ProfessionalPlanPage />} />
        <Route element={<PlanGate requires="management" />}>
          <Route path="funil" element={<CrmPipeline />} />
          <Route path="clientes" element={<CrmCustomers />} />
          <Route path="pacientes" element={<ProfessionalPatients />} />
          <Route path="conversas" element={<ProfessionalConversations />} />
          <Route path="integracoes" element={<SocialIntegrations />} />
          <Route path="agenda" element={<ProfessionalAgenda />} />
          <Route path="teleconsultas" element={<Placeholder title="Teleconsultas" description="Aguardando provedor seguro de videoconferência." />} />
          <Route path="financeiro" element={<FinanceSuite />} />
          <Route path="relatorios" element={<FinanceSuite initial="dre" />} />
          <Route path="minha-producao" element={<Navigate to="/profissional/agenda" replace />} />
        </Route>
        <Route element={<PlanGate requires="clinic" />}>
          <Route path="equipe" element={<ClinicTeam />} />
        </Route>
      </Route>
    </Route>

    <Route element={<ProtectedRoute role="admin" />}>
      <Route path="/admin" element={<PortalLayout role="admin" />}>
        <Route index element={<AdminHome />} />
        <Route path="profissionais" element={<AdminProfessionals />} />
        <Route path="agendamentos" element={<Placeholder title="Agendamentos da plataforma" description="A consolidação administrativa será ligada às agendas reais." />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="financeiro" element={<Placeholder title="Financeiro administrativo" description="Aguardando integração real de pagamentos e assinaturas." />} />
        <Route path="noticias" element={<AdminNewsPortal />} />
        <Route path="operacao" element={<AdminOperations />} />
        <Route path="configuracoes" element={<AdminOperations />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense><CookieConsent/></AuthProvider></BrowserRouter>
}
