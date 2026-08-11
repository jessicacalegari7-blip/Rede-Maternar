import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Landing } from './pages/public/Landing'
import { PortalHome } from './pages/public/PortalHome'
import { Marketplace } from './pages/public/Marketplace'
import { Login } from './pages/public/Login'
import { ProfessionalSignup } from './pages/public/ProfessionalSignup'
import { PublicProfessionalProfile } from './pages/public/PublicProfessionalProfile'
import { PatientInvitation } from './pages/public/PatientInvitation'
import { ProfessionalPatients } from './pages/professional/Patients'
import { ProfessionalProfilePage } from './pages/professional/Profile'
import { PortalLayout } from './layouts/PortalLayout'
import { CrmCustomers, CrmPipeline, ErpReports, ErpServices, ProfessionalOverview } from './pages/professional/Workspace'
import { PatientHome } from './pages/patient/Home'
import { PatientAppointments } from './pages/patient/Appointments'
import { AdminHome } from './pages/admin/Home'
import { AdminProfessionals } from './pages/admin/Professionals'
import { AdminAppointments } from './pages/admin/Appointments'
import { ProfessionalAgenda } from './pages/professional/Agenda'
import { Placeholder } from './pages/Placeholder'
import { ProfessionalConversations } from './pages/professional/Conversations'
import { PatientConversations } from './pages/patient/Conversations'
import { PatientPayments } from './pages/patient/Payments'
import { FinanceSuite } from './pages/professional/FinanceSuite'
import { Teleconsultations } from './pages/professional/Teleconsultations'
import { AdminFinance } from './pages/admin/Finance'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { hasManagement } from './lib/plans'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PlanGate } from './components/PlanGate'
import { ProfessionalNetwork } from './pages/professional/Network'
import { ProfessionalPlanPage } from './pages/professional/Plan'
import { PatientProfile } from './pages/patient/Profile'
import { AdminOperations, AdminUsers } from './pages/admin/Backoffice'
import { SocialIntegrations } from './pages/professional/SocialIntegrations'
import { ClinicTeam } from './pages/professional/ClinicTeam'
import { MyProduction } from './pages/professional/MyProduction'
import { SetPassword } from './pages/public/SetPassword'
import { AdminNewsPortal } from './pages/admin/NewsPortal'
import { RecoverPassword } from './pages/public/RecoverPassword'
import { ContactPage, CookiePolicy, LgpdPage, PrivacyPolicy, TermsOfUse } from './pages/public/Legal'

function ProfessionalEntry() {
  const { user } = useAuth()
  return hasManagement(user?.plan)
    ? <ProfessionalOverview />
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
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<PublicHome />} />
    <Route path="/para-profissionais" element={<Landing />} />
    <Route path="/profissionais" element={<Marketplace />} />
    <Route path="/login" element={<Login />} />
    <Route path="/definir-senha" element={<SetPassword />} />
    <Route path="/recuperar-senha" element={<RecoverPassword />} />
    <Route path="/cadastro-profissional" element={<ProfessionalSignup />} />
    <Route path="/privacidade" element={<PrivacyPolicy />} />
    <Route path="/termos" element={<TermsOfUse />} />
    <Route path="/lgpd" element={<LgpdPage />} />
    <Route path="/cookies" element={<CookiePolicy />} />
    <Route path="/contato" element={<ContactPage />} />
    <Route path="/perfil/:slug" element={<PublicProfessionalProfile />} />
    <Route path="/convite/:token" element={<PatientInvitation />} />

    <Route element={<ProtectedRoute role="patient" />}>
      <Route path="/paciente" element={<PortalLayout role="patient" />}>
        <Route index element={<PatientHome />} />
        <Route path="conversas" element={<PatientConversations />} />
        <Route path="agendamentos" element={<PatientAppointments />} />
        <Route path="pagamentos" element={<PatientPayments />} />
        <Route path="perfil" element={<PatientProfile />} />
      </Route>
    </Route>

    <Route element={<ProtectedRoute role="professional" />}>
      <Route path="/profissional" element={<PortalLayout role="professional" />}>
        <Route index element={<ProfessionalEntry />} />
        <Route path="perfil" element={<ProfessionalProfilePage />} />
        <Route path="servicos" element={<ErpServices />} />
        <Route path="plano" element={<ProfessionalPlanPage />} />
        <Route element={<PlanGate requires="management" />}>
          <Route path="rede" element={<ProfessionalNetwork />} />
          <Route path="funil" element={<CrmPipeline />} />
          <Route path="clientes" element={<CrmCustomers />} />
          <Route path="pacientes" element={<ProfessionalPatients />} />
          <Route path="conversas" element={<ProfessionalConversations />} />
          <Route path="integracoes" element={<SocialIntegrations />} />
          <Route path="agenda" element={<ProfessionalAgenda />} />
          <Route path="teleconsultas" element={<Teleconsultations />} />
          <Route path="financeiro" element={<FinanceSuite />} />
          <Route path="relatorios" element={<ErpReports />} />
          <Route path="minha-producao" element={<MyProduction />} />
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
        <Route path="agendamentos" element={<AdminAppointments />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="financeiro" element={<AdminFinance />} />
        <Route path="noticias" element={<AdminNewsPortal />} />
        <Route path="operacao" element={<AdminOperations />} />
        <Route path="configuracoes" element={<AdminOperations />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
