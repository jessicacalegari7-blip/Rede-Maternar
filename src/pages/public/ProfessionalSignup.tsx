import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { registerProfessional } from '../../lib/auth'
import { maternalChildSpecialties } from '../../data/specialties'

export function ProfessionalSignup() {
  const [searchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plano')
  const initialPlan = requestedPlan === 'business' || requestedPlan === 'marketplace' ? requestedPlan : 'free'
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [acceptsInsurance, setAcceptsInsurance] = useState(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const confirmation = String(form.get('passwordConfirmation'))
    if (password !== confirmation) {
      setError('As senhas precisam ser iguais.')
      return
    }
    try {
      registerProfessional({
        name: String(form.get('name')),
        email: String(form.get('email')),
        phone: String(form.get('phone')),
        specialty: String(form.get('specialty')),
        city: String(form.get('city')),
        registration: String(form.get('registration') ?? ''),
        password,
        plan: String(form.get('plan')) === 'business' ? 'business' : String(form.get('plan')) === 'marketplace' ? 'marketplace' : 'free',
      })
      setSuccess(true)
      event.currentTarget.reset()
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Não foi possível enviar o cadastro.')
    }
  }

  if (success) {
    return <div className="auth-page"><div className="auth-card success-card"><Logo /><div className="success-icon">✓</div><h1>Cadastro recebido</h1><p>Seus dados foram enviados para análise da equipe Rede Maternar.</p><p className="muted">Assim que o cadastro for aprovado, você poderá entrar usando o e-mail e a senha informados.</p><Link className="btn btn-primary" to="/login">Ir para o login</Link></div></div>
  }

  return (
    <div className="auth-page">
      <form className="auth-card auth-card-wide" onSubmit={submit}>
        <Logo />
        <span className="badge">Cadastro profissional</span>
        <h1>Faça parte da Rede Maternar</h1>
        <p className="muted">Preencha seus dados e escolha como deseja participar da Rede Maternar.</p>
        <div className="plan-selector plan-selector-3"><label><input type="radio" name="plan" value="free" defaultChecked={initialPlan === 'free'} /><span><strong>Marketplace Gratuito</strong><small>Até 30 visitas mensais no perfil, sem selo verificado.</small></span></label><label><input type="radio" name="plan" value="marketplace" defaultChecked={initialPlan === 'marketplace'} /><span><strong>Marketplace Ilimitado</strong><small>R$ 29,90 por mês, visitas ilimitadas e selo verificado.</small></span></label><label><input type="radio" name="plan" value="business" defaultChecked={initialPlan === 'business'} /><span><strong>Gestão Completa</strong><small>R$ 159,90 por mês com CRM, ERP, Marketplace e equipe para clínicas.</small></span></label></div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field field-span-2"><label>Nome completo</label><input name="name" placeholder="Seu nome" required minLength={3} /></div>
          <div className="field"><label>E-mail profissional</label><input name="email" type="email" placeholder="voce@email.com" required /></div>
          <div className="field"><label>WhatsApp</label><input name="phone" placeholder="(11) 99999-9999" required /></div>
          <div className="field"><label>Especialidade</label><select name="specialty" required><option value="">Selecione</option>{maternalChildSpecialties.map((specialty) => <option key={specialty}>{specialty}</option>)}<option>Outra especialidade materno-infantil</option></select></div>
          <div className="field"><label>Registro profissional</label><input name="registration" placeholder="Quando aplicável" /></div>
          <div className="field field-span-2"><label>Cidade e estado</label><input name="city" placeholder="São Paulo, SP" required /></div>
          <div className="field field-span-2 insurance-signup"><label className="check-row"><input type="checkbox" checked={acceptsInsurance} onChange={e=>setAcceptsInsurance(e.target.checked)}/><span><strong>Atendo por convênio ou plano de saúde</strong><small>Marque para informar os convênios aceitos.</small></span></label>{acceptsInsurance&&<div className="insurance-options">{['Unimed','Bradesco Saúde','SulAmérica','Amil','NotreDame Intermédica','Porto Saúde','Omint','Care Plus','Hapvida','Outro'].map(item=><label key={item}><input type="checkbox" name="insurances" value={item}/>{item}</label>)}</div>}</div>
          <div className="field"><label>Crie uma senha</label><input name="password" type="password" minLength={6} required /></div>
          <div className="field"><label>Confirme a senha</label><input name="passwordConfirmation" type="password" minLength={6} required /></div>
        </div>
        <label className="check-row"><input type="checkbox" required /> <span>Confirmo que os dados informados são verdadeiros e aceito a análise cadastral.</span></label>
        <button className="btn btn-primary" style={{ width: '100%' }}>Enviar para análise</button>
        <p className="muted auth-footer">Já possui cadastro? <Link to="/login"><strong>Entrar</strong></Link></p>
      </form>
    </div>
  )
}
