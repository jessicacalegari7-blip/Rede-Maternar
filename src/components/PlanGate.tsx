import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { hasManagement, isClinicPlan } from '../lib/plans'

type PlanGateProps = { requires?: 'management' | 'clinic' }

export function PlanGate({ requires = 'management' }: PlanGateProps) {
  const { user } = useAuth()
  if (user?.role !== 'professional') return <Navigate to="/login" replace />

  const allowed = requires === 'clinic'
    ? isClinicPlan(user.plan)
    : hasManagement(user.plan)

  return allowed ? <Outlet /> : <Navigate to="/profissional/perfil" replace />
}