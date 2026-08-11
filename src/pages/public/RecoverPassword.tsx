import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { supabase } from '../../lib/supabase'

export function RecoverPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return setError('A autenticação não está disponível.')
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    })
    if (resetError) return setError(resetError.message)
    setSent(true)
  }

  return <div className="auth-page">
    <form className="auth-card" onSubmit={submit}>
      <Logo />
      <h1>Redefinir senha</h1>
      <p className="muted">Enviaremos um novo link seguro para o seu e-mail.</p>
      {error && <div className="alert alert-error">{error}</div>}
      {sent ? <div className="alert alert-success">Link enviado. Verifique também a caixa de spam.</div> : <>
        <label className="field"><span>E-mail</span><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <button className="btn btn-primary" style={{ width: '100%' }}>Enviar novo link</button>
      </>}
      <p className="auth-footer muted"><Link to="/login">Voltar para o login</Link></p>
    </form>
  </div>
}
