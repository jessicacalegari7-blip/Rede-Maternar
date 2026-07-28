import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
export function PlanGate(){const {user}=useAuth();return user?.role==='professional'&&user.plan!=='annual'?<Navigate to="/profissional/plano" replace/>:<Outlet/>}
