import {useEffect,useState,type FormEvent} from 'react'
import {Link,useNavigate,useSearchParams} from 'react-router-dom'
import {Logo} from '../../components/Logo'
import {supabase} from '../../lib/supabase'

type Invite={email:string;name:string;existing_account:boolean;expires_at:string}

export function PremiumInvite(){
  const [params]=useSearchParams(),token=params.get('token')||'',nav=useNavigate()
  const [invite,setInvite]=useState<Invite|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
  useEffect(()=>{void(async()=>{try{const response=await fetch(`/api/asaas-checkout?action=invite&token=${encodeURIComponent(token)}`,{cache:'no-store'}),body=await response.json();if(!response.ok)throw new Error(body.error||'Convite inválido.');setInvite(body)}catch(reason){setError(reason instanceof Error?reason.message:'Convite inválido.')}finally{setLoading(false)}})()},[token])
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!invite)return;const form=new FormData(event.currentTarget),password=String(form.get('password')||''),confirmation=String(form.get('confirmation')||'');if(password!==confirmation){setError('As senhas precisam ser iguais.');return}setSaving(true);setError('');try{const session=invite.existing_account&&supabase?(await supabase.auth.getSession()).data.session:null;const response=await fetch('/api/asaas-checkout?action=invite',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({token,password})}),body=await response.json();if(!response.ok)throw Object.assign(new Error(body.error||'Não foi possível criar o acesso.'),{code:body.code});if(!invite.existing_account&&supabase)await supabase.auth.signInWithPassword({email:invite.email,password});nav('/profissional/perfil',{replace:true})}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível criar o acesso.')}finally{setSaving(false)}}
  if(loading)return <div className="auth-page"><div className="auth-card"><Logo/><p>Validando seu convite seguro…</p></div></div>
  if(error&&!invite)return <div className="auth-page"><div className="auth-card"><Logo/><h1>Convite indisponível</h1><div className="alert alert-error">{error}</div><Link className="btn btn-primary" to="/checkout/status">Voltar</Link></div></div>
  return <div className="auth-page"><form className="auth-card" onSubmit={submit}><Logo/><span className="badge">Pagamento confirmado</span><h1>{invite?.existing_account?'Vincule sua conta':'Crie seu acesso'}</h1><p className="muted">Olá, {invite?.name}. Seu Perfil Premium de 12 meses está pronto para ser ativado.</p>{error&&<div className="alert alert-error">{error}</div>}{invite?.existing_account?<ExistingAccountInvite token={token} saving={saving}/>:<><label className="field"><span>Crie uma senha</span><input name="password" type="password" minLength={8} required autoComplete="new-password"/></label><label className="field"><span>Confirme a senha</span><input name="confirmation" type="password" minLength={8} required autoComplete="new-password"/></label><button className="btn btn-primary full" disabled={saving}>{saving?'Criando acesso…':'Criar acesso e completar perfil'}</button></>}</form></div>
}

function ExistingAccountInvite({token,saving}:{token:string;saving:boolean}){
  const [authenticated,setAuthenticated]=useState(false)
  useEffect(()=>{void supabase?.auth.getSession().then(({data})=>setAuthenticated(Boolean(data.session)))},[])
  return <><div className="alert alert-success">Este e-mail já possui conta. A compra será vinculada sem criar cadastro duplicado.</div><input type="hidden" name="password" value="existing-account"/><input type="hidden" name="confirmation" value="existing-account"/>{authenticated?<button className="btn btn-primary full" disabled={saving}>{saving?'Vinculando…':'Vincular compra à minha conta'}</button>:<Link className="btn btn-secondary full" to="/login" state={{from:`/convite-premium?token=${encodeURIComponent(token)}`}}>Entrar na minha conta</Link>}</>
}
