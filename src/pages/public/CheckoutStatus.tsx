import {useEffect,useState} from 'react'
import {Link,useSearchParams} from 'react-router-dom'
import {Logo} from '../../components/Logo'

type OrderStatus={status:string;product_name:string;amount_cents:number;paid_at:string|null;expires_at:string|null}
const labels:Record<string,string>={creating:'Preparando pagamento',pending:'Aguardando confirmação do pagamento',paid:'Pagamento confirmado',canceled:'Checkout cancelado',expired:'Checkout expirado',refunded:'Pagamento estornado',chargeback:'Pagamento contestado',failed:'Não foi possível criar o pagamento'}

export function CheckoutStatus(){
  const [params]=useSearchParams(),token=params.get('token')||'', [order,setOrder]=useState<OrderStatus|null>(null),[error,setError]=useState('')
  useEffect(()=>{let active=true,timer:number|undefined;async function load(){try{const response=await fetch(`/api/asaas-checkout?token=${encodeURIComponent(token)}`,{cache:'no-store'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Pedido não encontrado.');if(active){setOrder(data);setError('');if(['creating','pending'].includes(data.status))timer=window.setTimeout(load,5000)}}catch(reason){if(active)setError(reason instanceof Error?reason.message:'Não foi possível consultar o pedido.')}}void load();return()=>{active=false;if(timer)clearTimeout(timer)}},[token])
  return <main className="auth-page"><section className="auth-card success-card"><Logo/><span className="badge">Perfil Premium MaterPlace</span><h1>{order?labels[order.status]||'Status do pedido':'Consultando pagamento…'}</h1>{error&&<div className="alert alert-error">{error}</div>}{order&&<><p>Valor: <strong>{(order.amount_cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></p>{order.status==='paid'?<><div className="success-icon">✓</div><p>Seu acesso foi liberado. Complete o perfil profissional; a publicação ocorrerá após o preenchimento e a aprovação.</p><Link className="btn btn-primary full" to="/login">Entrar e completar o perfil</Link></>:<><p className="muted">A confirmação é feita exclusivamente pelo webhook financeiro do Asaas. Esta página não aprova pagamentos.</p><button className="btn btn-secondary full" onClick={()=>location.reload()}>Atualizar status</button></>}</>}</section></main>
}
