import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { hasManagement } from '../lib/plans'

export function PlanGate() {
  const { user } = useAuth()
  return user?.role === 'professional' && !hasManagement(user.plan)
    ? <Navigate to="/profissional/plano" replace />
    : <Outlet />
}
