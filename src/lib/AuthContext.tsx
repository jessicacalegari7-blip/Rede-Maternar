import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authenticate, getSession, setSession, type PublicUser } from './auth'
import { acceptInvitation } from './invitations'
import { getRemotePublicUser, loginWithSupabase } from './supabaseAuth'
import { supabase } from './supabase'

interface AuthContextValue {
  user: PublicUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<PublicUser>
  logout: () => Promise<void>
  registerPatient: (token: string, input: { name: string; email: string; phone: string; password: string }) => PublicUser
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialLocalSession] = useState(() => getSession())
  const [user, setUser] = useState<PublicUser | null>(initialLocalSession)
  const [loading, setLoading] = useState(Boolean(supabase && !initialLocalSession))

  useEffect(() => {
    if (!supabase || initialLocalSession) {
      setLoading(false)
      return
    }
    let active = true
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session?.user) {
        try {
          setUser(await getRemotePublicUser(data.session.user))
        } catch {
          await supabase.auth.signOut()
        }
      }
      if (active) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) setUser(null)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [initialLocalSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email: string, password: string) {
        const isDemoAccount = email.trim().toLowerCase().endsWith('@redematernar.com')
        const authenticatedUser = isDemoAccount
          ? authenticate(email, password)
          : await loginWithSupabase(email, password)
        setSession(isDemoAccount ? authenticatedUser : null)
        setUser(authenticatedUser)
        return authenticatedUser
      },
      registerPatient(token: string, input: { name: string; email: string; phone: string; password: string }) {
        const newUser = acceptInvitation(token, input)
        setSession(newUser)
        setUser(newUser)
        return newUser
      },
      async logout() {
        if (supabase) await supabase.auth.signOut()
        setSession(null)
        setUser(null)
      },
    }),
    [loading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider')
  return context
}
