import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Logo } from '../../components/Logo'

export function ProfessionalSignup(){
  const [params]=useSearchParams()
  const [error,setError]=useState(''),[loading,setLoading]=useState(false)
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');const form=new FormData(event.currentTarget)
    setLoading(true)
    try{
      const attribution=Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','campaign_id'].map(key=>[key,params.get(key)]).filter(([,value])=>value))
      const response=await fetch('/api/asaas-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:String(form.get('name')),email:String(form.get('email')),phone:String(form.get('phone')),taxId:String(form.get('taxId')||''),attribution})})
      const checkout=await response.json()
      if(!response.ok)throw new Error(checkout.error||'Não foi possível iniciar o pagamento.')
      window.location.assign(checkout.checkoutUrl)
    }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível enviar o cadastro.')}
    finally{setLoading(false)}
  }
  return <div className="auth-page"><form className="auth-card auth-card-wide" onSubmit={submit}><Logo/><span className="badge">Perfil Premium MaterPlace</span><h1>Contrate primeiro. Crie seu acesso depois.</h1><p className="muted">R$ 59,99 por 12 meses, sem renovação automática. O cadastro profissional será preenchido após a confirmação do pagamento.</p>
    <div className="alert alert-success"><strong>Checkout individual e seguro pelo Asaas.</strong> Após o pagamento, enviaremos por e-mail um convite exclusivo para criar sua senha.</div>
    <section className="card" aria-labelledby="checkout-steps-title"><h2 id="checkout-steps-title">Como funciona sua contratação</h2><ol><li>Preencha seus dados e realize o pagamento seguro pelo Asaas.</li><li>Após a confirmação, você receberá um e-mail para criar sua senha.</li><li>Acesse a MaterPlace e complete seu perfil profissional.</li></ol><p className="muted"><strong>Importante:</strong> após o pagamento, confira seu e-mail, inclusive as abas Promoções, Atualizações e Spam.</p></section>
    {error&&<div className="alert alert-error">{error}</div>}<div className="form-grid"><div className="field"><label>Nome profissional</label><input name="name" required minLength={3}/></div><div className="field"><label>E-mail</label><input name="email" type="email" required/></div><div className="field"><label>Telefone ou WhatsApp</label><input name="phone" required/></div><div className="field"><label>CPF ou CNPJ</label><input name="taxId" inputMode="numeric" required/></div></div>
    <p className="muted">A MaterPlace não recebe dados do cartão. Seu acesso será criado somente após o pagamento confirmado pelo Asaas.</p><label className="check-row"><input type="checkbox" required/><span>Aceito os <Link to="/termos" target="_blank">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank">Política de Privacidade</Link>.</span></label><button className="btn btn-primary full" disabled={loading}>{loading?'Preparando checkout seguro…':'Contratar Perfil Premium'}</button><p className="muted auth-footer">Já possui cadastro? <Link to="/login"><strong>Entrar na minha conta</strong></Link></p>
  </form></div>
}
