import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { supabase } from '../../lib/supabase'

export function SetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setError('A autenticação ainda não está configurada.')
      return
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError || !data.session) {
        setError('Este convite expirou ou já foi utilizado. Solicite um novo link de acesso.')
        return
      }
      setReady(true)
    })
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('As senhas informadas não são iguais.')
      return
    }
    if (!supabase) return

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/admin', { replace: true })
  }

  return <div className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <Logo />
      <h1>Crie sua senha</h1>
      <p className="muted">Defina a senha que será usada para acessar a administração da Rede Maternar.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <label className="field">
        <span>Nova senha</span>
        <input
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Confirme a nova senha</span>
        <input
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={!ready || saving}>
        {saving ? 'Salvando…' : 'Criar senha e entrar'}
      </button>
      {!ready && !error && <p className="muted">Validando seu convite…</p>}
      <p className="auth-footer muted"><Link to="/login">Voltar para o login</Link></p>
    </form>
  </div>
}
