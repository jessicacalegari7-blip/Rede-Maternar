import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../lib/types'
import { useAuth } from '../lib/AuthContext'

export function ProtectedRoute({ role }: { role: UserRole }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="auth-page"><div className="auth-card"><p>Carregando acesso seguro...</p></div></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== role) {
    const destination = user.role === 'patient' ? '/paciente' : user.role === 'professional' ? '/profissional' : '/admin'
    return <Navigate to={destination} replace />
  }
  return <Outlet />
}
