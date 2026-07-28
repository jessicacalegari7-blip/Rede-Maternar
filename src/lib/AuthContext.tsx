import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { authenticate, getSession, setSession, type PublicUser } from './auth'
import { acceptInvitation } from './invitations'

interface AuthContextValue {
  user: PublicUser | null
  login: (email: string, password: string) => PublicUser
  logout: () => void
  registerPatient: (token: string, input: { name: string; email: string; phone: string; password: string }) => PublicUser
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => getSession())

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login(email: string, password: string) {
        const authenticatedUser = authenticate(email, password)
        setSession(authenticatedUser)
        setUser(authenticatedUser)
        return authenticatedUser
      },
      registerPatient(token: string, input: { name: string; email: string; phone: string; password: string }) {
        const newUser = acceptInvitation(token, input)
        setSession(newUser)
        setUser(newUser)
        return newUser
      },
      logout() {
        setSession(null)
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return context
}
