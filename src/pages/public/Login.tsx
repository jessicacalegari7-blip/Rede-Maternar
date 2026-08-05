import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { useAuth } from '../../lib/AuthContext'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      const requestedPath = (location.state as { from?: string } | null)?.from
      const home = user.role === 'patient' ? '/paciente' : user.role === 'professional' ? '/profissional' : '/admin'
      nav(requestedPath?.startsWith(home) ? requestedPath : home, { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Entrar na Rede Maternar</h1>
        <p className="muted">Use seu e-mail e senha. O sistema identifica automaticamente o seu ambiente.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        </div>
        <p className="auth-recovery-link"><Link to="/recuperar-senha">Esqueci minha senha</Link></p>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="auth-signup-callout">
          <strong>Ainda não possui cadastro?</strong>
          <p className="muted">Crie o perfil da sua clínica ou o seu cadastro como profissional independente.</p>
          <Link className="btn btn-secondary" to="/cadastro-profissional" style={{ width: '100%' }}>
            Criar cadastro
          </Link>
        </div>

        <p className="muted auth-footer"><Link to="/">Voltar para a página inicial</Link></p>
      </form>
    </div>
  )
}
