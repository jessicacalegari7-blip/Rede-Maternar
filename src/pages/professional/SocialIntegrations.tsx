import { useState } from 'react'
import { CheckCircle2, Facebook, Instagram, MessageCircle, PlugZap, RefreshCw, ShieldCheck, Webhook } from 'lucide-react'

const channels = [
  {name:'WhatsApp Business',icon:MessageCircle,status:'Conectado',account:'(11) 99999-1122',copy:'Mensagens, confirmações e lembretes automáticos.'},
  {name:'Instagram',icon:Instagram,status:'Conectado',account:'@dra.marinalopes',copy:'Directs e respostas elegíveis centralizados no CRM.'},
  {name:'Facebook Messenger',icon:Facebook,status:'Conectar',account:'Página profissional',copy:'Mensagens da página e respostas privadas.'},
  {name:'TikTok Business',icon:PlugZap,status:'Disponibilidade limitada',account:'Conta comercial',copy:'Integração condicionada às APIs e permissões liberadas pela plataforma.'},
]

export function SocialIntegrations(){
  const [connected,setConnected]=useState<string[]>(['WhatsApp Business','Instagram'])
  return <><div className="page-heading"><div><span className="badge">CRM omnichannel</span><h1>Integrações e canais</h1><p className="muted">Centralize mensagens autorizadas pelas APIs oficiais e registre automaticamente a origem de cada conversa.</p></div><button className="btn btn-secondary"><RefreshCw/> Sincronizar canais</button></div>
    <div className="integration-policy"><ShieldCheck/><div><strong>Integrações oficiais e consentidas</strong><span>Cada rede depende de conta comercial, aprovação, permissões e recursos disponibilizados pela respectiva API. O CRM não captura mensagens fora dessas regras.</span></div></div>
    <div className="grid grid-2 social-channel-grid">{channels.map(({name,icon:Icon,status,account,copy})=>{const active=connected.includes(name);return <article className="card social-channel-card" key={name}><div className="social-channel-icon"><Icon/></div><div><div className="row"><h2>{name}</h2>{active&&<span className="status-pill status-success"><CheckCircle2/> Ativo</span>}</div><p>{copy}</p><small>{account}</small></div><button className={`btn ${active?'btn-secondary':'btn-primary'}`} onClick={()=>setConnected(active?connected.filter(x=>x!==name):[...connected,name])}>{active?'Gerenciar conexão':status}</button></article>})}</div>
    <div className="grid grid-2" style={{marginTop:18}}><section className="card"><div className="section-heading"><div><h2>Roteamento para o CRM</h2><p className="muted">Regras aplicadas quando uma nova mensagem chega.</p></div><Webhook/></div>{[['Criar oportunidade automaticamente','Ativo'],['Registrar rede, campanha e perfil de origem','Ativo'],['Distribuir para atendente disponível','Ativo'],['Unificar contatos com mesmo telefone ou e-mail','Ativo']].map(([label,status])=><div className="list-item" key={label}><span>{label}</span><span className="badge">{status}</span></div>)}</section><section className="card"><h2>Origem das mensagens no mês</h2>{[['WhatsApp Business','62%'],['Instagram Direct','24%'],['Facebook Messenger','9%'],['Marketplace Rede Maternar','5%']].map(([name,value])=><div className="channel-origin" key={name}><span>{name}</span><div><i style={{width:value}}/></div><strong>{value}</strong></div>)}</section></div>
  </>
}
