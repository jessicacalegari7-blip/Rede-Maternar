import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Landing } from './pages/public/Landing'
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
import { ProfessionalFinance } from './pages/professional/Finance'
import { AdminFinance } from './pages/admin/Finance'
import { AuthProvider } from './lib/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { PlanGate } from './components/PlanGate'
import { ProfessionalNetwork } from './pages/professional/Network'
import { ProfessionalPlanPage } from './pages/professional/Plan'
import { PatientProfile } from './pages/patient/Profile'

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={<Login />} />
    <Route path="/cadastro-profissional" element={<ProfessionalSignup />} />
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
        <Route index element={<ProfessionalOverview />} />
        <Route path="rede" element={<ProfessionalNetwork />} />
        <Route path="plano" element={<ProfessionalPlanPage />} />
        <Route element={<PlanGate />}>
          <Route path="funil" element={<CrmPipeline />} />
          <Route path="clientes" element={<CrmCustomers />} />
          <Route path="pacientes" element={<ProfessionalPatients />} />
          <Route path="conversas" element={<ProfessionalConversations />} />
          <Route path="agenda" element={<ProfessionalAgenda />} />
          <Route path="servicos" element={<ErpServices />} />
          <Route path="financeiro" element={<ProfessionalFinance />} />
          <Route path="relatorios" element={<ErpReports />} />
          <Route path="perfil" element={<ProfessionalProfilePage />} />
        </Route>
      </Route>
    </Route>

    <Route element={<ProtectedRoute role="admin" />}>
      <Route path="/admin" element={<PortalLayout role="admin" />}>
        <Route index element={<AdminHome />} />
        <Route path="profissionais" element={<AdminProfessionals />} />
        <Route path="agendamentos" element={<AdminAppointments />} />
        <Route path="usuarios" element={<Placeholder title="Usuários" description="Pacientes, profissionais e equipe administrativa." />} />
        <Route path="financeiro" element={<AdminFinance />} />
        <Route path="configuracoes" element={<Placeholder title="Configurações" description="Planos, taxas, permissões e integrações." />} />
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
