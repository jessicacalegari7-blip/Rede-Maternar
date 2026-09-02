import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { registerProfessional } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { registerProfessionalWithSupabase } from '../../lib/supabaseAuth'
import { specialtyLimitForPlan, type ProfessionalPlan } from '../../lib/plans'
import { CityAutocomplete, useDirectorySpecialties } from '../../components/DirectorySearchFields'

export function ProfessionalSignup() {
  const [searchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plano')
  const initialPlan = ['marketplace','independent','clinic'].includes(requestedPlan ?? '') ? requestedPlan : 'marketplace'
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [acceptsInsurance, setAcceptsInsurance] = useState(false)
  const [loading, setLoading] = useState(false)
  const [plan,setPlan]=useState<ProfessionalPlan>(initialPlan as ProfessionalPlan)
  const [specialties,setSpecialties]=useState<string[]>([])
  const [visibilityCities,setVisibilityCities]=useState<string[]>([])
  const specialtyLimit=specialtyLimitForPlan(plan)
  const directorySpecialties=useDirectorySpecialties()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    const confirmation = String(form.get('passwordConfirmation'))
    if (password !== confirmation) {
      setError('As senhas precisam ser iguais.')
      return
    }
    setLoading(true)
    try {
      const input = {
        name: String(form.get('name')),
        organizationName: String(form.get('organizationName') || form.get('name')),
        email: String(form.get('email')),
        phone: String(form.get('phone')),
        specialty: specialties[0] || '',
        specialties,
        city: String(form.get('city')),
        registration: String(form.get('registration') ?? ''),
        password,
        plan,
        insurances: form.getAll('insurances').map(String),
        visibilityCities:visibilityCities.length?visibilityCities:[String(form.get('city'))],
      }
      if(!specialties.length) throw new Error('Selecione ao menos uma especialidade.')
      if (isSupabaseConfigured) await registerProfessionalWithSupabase(input)
      else registerProfessional(input)
      setSuccess(true)
      event.currentTarget.reset()
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Não foi possível enviar o cadastro.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return <div className="auth-page"><div className="auth-card success-card"><Logo /><div className="success-icon">✓</div><h1>Cadastro recebido</h1><p>Seus dados foram enviados para análise da equipe MaterPlace.</p><p className="muted">Assim que o cadastro for aprovado, você poderá entrar usando o e-mail e a senha informados.</p><Link className="btn btn-primary" to="/login">Ir para o login</Link></div></div>
  }

  return (
    <div className="auth-page">
      <form className="auth-card auth-card-wide" onSubmit={submit}>
        <Logo />
        <span className="badge">Cadastro profissional</span>
        <h1>Faça parte da MaterPlace</h1>
        <p className="muted">Preencha seus dados e escolha como deseja participar da MaterPlace.</p>
        <div className="plan-selector plan-selector-3">{([['marketplace','Marketplace','1 especialidade'],['independent','Profissional Individual + CRM + ERP','Até 3 especialidades'],['clinic','Clínica + CRM + ERP','Especialidades ilimitadas']] as const).map(([value,title,detail])=><label key={value}><input type="radio" name="plan" value={value} checked={plan===value} onChange={()=>{setPlan(value);const limit=specialtyLimitForPlan(value);if(limit!==null)setSpecialties(current=>current.slice(0,limit))}}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <div className="field"><label>Nome da responsável</label><input name="name" placeholder="Seu nome" required minLength={3} /></div>
          <div className="field"><label>Nome da clínica ou perfil</label><input name="organizationName" placeholder="Nome que será exibido" required minLength={3} /></div>
          <div className="field"><label>E-mail profissional</label><input name="email" type="email" placeholder="voce@email.com" required /></div>
          <div className="field"><label>WhatsApp</label><input name="phone" placeholder="(11) 99999-9999" required /></div>
          <div className="field field-span-2"><label>Especialidades {specialtyLimit===null?'(ilimitadas)':`(${specialties.length} de ${specialtyLimit})`}</label><div className="specialty-picker">{directorySpecialties.map(name=>{const selected=specialties.includes(name);const disabled=!selected&&specialtyLimit!==null&&specialties.length>=specialtyLimit;return <label className={`specialty-choice ${selected?'selected':''}`} key={name}><input type="checkbox" checked={selected} disabled={disabled} onChange={()=>setSpecialties(current=>selected?current.filter(item=>item!==name):[...current,name])}/><span>{name}</span></label>})}</div></div>
          <div className="field"><label>Registro profissional</label><input name="registration" placeholder="Quando aplicável" /></div>
          <div className="field field-span-2"><label>Cidade da clínica/endereço</label><CityAutocomplete required /></div>
          <div className="field field-span-2"><label>Cidades de divulgação</label><CityAutocomplete name="visibilityCity" onSelect={label=>setVisibilityCities(current=>current.includes(label)?current:[...current,label])}/><div className="selected-city-tags">{visibilityCities.map(city=><button type="button" key={city} onClick={()=>setVisibilityCities(current=>current.filter(item=>item!==city))}>{city} ×</button>)}</div><small>Escolha uma cidade por vez. Você poderá alterar esta lista no perfil.</small></div>
          <div className="field field-span-2 insurance-signup"><label className="check-row"><input type="checkbox" checked={acceptsInsurance} onChange={e=>setAcceptsInsurance(e.target.checked)}/><span><strong>Atendo por convênio ou plano de saúde</strong><small>Marque para informar os convênios aceitos.</small></span></label>{acceptsInsurance&&<div className="insurance-options">{['Unimed','Bradesco Saúde','SulAmérica','Amil','NotreDame Intermédica','Porto Saúde','Omint','Care Plus','Hapvida','Outro'].map(item=><label key={item}><input type="checkbox" name="insurances" value={item}/>{item}</label>)}</div>}</div>
          <div className="field"><label>Crie uma senha</label><input name="password" type="password" minLength={6} required /></div>
          <div className="field"><label>Confirme a senha</label><input name="passwordConfirmation" type="password" minLength={6} required /></div>
        </div>
        <label className="check-row"><input type="checkbox" required /> <span>Confirmo que os dados são verdadeiros e aceito os <Link to="/termos" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank">Política de Privacidade</Link>.</span></label>
        <button className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>{loading?'Enviando cadastro…':'Enviar para análise'}</button>
        <p className="muted auth-footer">Já possui cadastro? <Link to="/login"><strong>Entrar</strong></Link></p>
      </form>
    </div>
  )
}
