import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { registerProfessional } from '../../lib/auth'
import { isSupabaseConfigured } from '../../lib/supabase'
import { registerProfessionalWithSupabase } from '../../lib/supabaseAuth'
import { type ProfessionalPlan } from '../../lib/plans'

const choices:[ProfessionalPlan,string,string][]=[
  ['marketplace','Plano Essencial — R$ 9,99/mês','1 especialidade após a aprovação'],
  ['independent','Profissional Individual — a partir de R$ 59,90/mês','Até 3 especialidades + CRM + ERP'],
  ['clinic','Clínica — a partir de R$ 99,90/mês','Profissionais e especialidades ilimitados + CRM + ERP'],
]

export function ProfessionalSignup(){
  const [params]=useSearchParams(),requested=params.get('plano')
  const [plan,setPlan]=useState<ProfessionalPlan>(['marketplace','independent','clinic'].includes(requested||'')?requested as ProfessionalPlan:'marketplace')
  const [success,setSuccess]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');const form=new FormData(event.currentTarget),password=String(form.get('password')),confirmation=String(form.get('passwordConfirmation'))
    if(password!==confirmation){setError('As senhas precisam ser iguais.');return}
    setLoading(true)
    try{
      const input={name:String(form.get('name')),organizationName:String(form.get('name')),email:String(form.get('email')),phone:String(form.get('phone')),password,plan,specialty:'',specialties:[],city:'Não informada, SP',visibilityCities:[]}
      if(isSupabaseConfigured)await registerProfessionalWithSupabase(input);else registerProfessional(input)
      setSuccess(true);event.currentTarget.reset()
    }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível enviar o cadastro.')}
    finally{setLoading(false)}
  }
  if(success)return <div className="auth-page"><div className="auth-card success-card"><Logo/><div className="success-icon">✓</div><h1>Cadastro recebido</h1><p>Após aprovação, você receberá a confirmação e completará especialidades, endereços e perfil dentro da MaterPlace.</p><Link className="btn btn-primary" to="/login">Ir para o login</Link></div></div>
  return <div className="auth-page"><form className="auth-card auth-card-wide" onSubmit={submit}><Logo/><span className="badge">Cadastro profissional</span><h1>Comece com seus dados de acesso</h1><p className="muted">Agora pedimos somente os dados essenciais. O perfil completo será preenchido após a aprovação.</p>
    <div className="plan-selector plan-selector-3">{choices.map(([value,title,detail])=><label key={value}><input type="radio" name="plan" value={value} checked={plan===value} onChange={()=>setPlan(value)}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div>
    {error&&<div className="alert alert-error">{error}</div>}<div className="form-grid"><div className="field"><label>Nome</label><input name="name" required minLength={3}/></div><div className="field"><label>E-mail</label><input name="email" type="email" required/></div><div className="field field-span-2"><label>Telefone ou WhatsApp</label><input name="phone" required/></div><div className="field"><label>Senha de acesso</label><input name="password" type="password" minLength={6} required/></div><div className="field"><label>Confirme a senha</label><input name="passwordConfirmation" type="password" minLength={6} required/></div></div>
    <p className="muted">A senha é solicitada apenas para permitir o primeiro acesso após a aprovação.</p><label className="check-row"><input type="checkbox" required/><span>Aceito os <Link to="/termos" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank">Política de Privacidade</Link>.</span></label><button className="btn btn-primary full" disabled={loading}>{loading?'Enviando…':'Enviar para aprovação'}</button><p className="muted auth-footer">Já possui cadastro? <Link to="/login"><strong>Entrar</strong></Link></p>
  </form></div>
}
