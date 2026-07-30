import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { useAuth } from '../../lib/AuthContext'

const demoAccounts = [
  { label: 'Paciente', email: 'paciente@redematernar.com' },
  { label: 'Clínica', email: 'profissional@redematernar.com' },
  { label: 'Profissional independente', email: 'independente@redematernar.com' },
  { label: 'Administrador', email: 'admin@redematernar.com' },
]

export function Login() {
  const [email, setEmail] = useState('profissional@redematernar.com')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()
  const location = useLocation()

  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = login(email, password)
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
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="demo-box">
          <strong>Acessos para aprovação</strong>
          <p className="muted">Senha de todos: 123456</p>
          <div className="demo-list">
            {demoAccounts.map((account) => (
              <button key={account.email} type="button" onClick={() => { setEmail(account.email); setPassword('123456') }}>
                <span>{account.label}</span><small>{account.email}</small>
              </button>
            ))}
          </div>
        </div>

        <p className="muted auth-footer"><Link to="/">Voltar para a página inicial</Link></p>
      </form>
    </div>
  )
}
