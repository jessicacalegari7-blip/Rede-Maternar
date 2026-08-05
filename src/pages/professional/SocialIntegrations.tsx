import { useEffect, useState } from 'react'
import { CheckCircle2, Facebook, Instagram, MessageCircle, PlugZap, RefreshCw, ShieldCheck, Webhook } from 'lucide-react'
import { getWhatsAppConnection, prepareWhatsAppConnection, type WhatsAppConnection } from '../../lib/operations'

const channels = [
  {name:'Instagram',icon:Instagram,status:'Conectar',account:'Conta profissional',copy:'Directs e respostas elegíveis centralizados no CRM.'},
  {name:'Facebook Messenger',icon:Facebook,status:'Conectar',account:'Página profissional',copy:'Mensagens da página e respostas privadas.'},
  {name:'TikTok Business',icon:PlugZap,status:'Disponibilidade limitada',account:'Conta comercial',copy:'Integração condicionada às APIs e permissões liberadas pela plataforma.'},
]

export function SocialIntegrations(){
  const [connected,setConnected]=useState<string[]>([])
  const [whatsApp,setWhatsApp]=useState<WhatsAppConnection|null>(null)
  const [notice,setNotice]=useState('')
  const [error,setError]=useState('')

  useEffect(()=>{getWhatsAppConnection().then(setWhatsApp).catch(err=>setError(err instanceof Error?err.message:'Falha ao consultar conexão.'))},[])

  async function prepare(provider:WhatsAppConnection['provider']){
    setError(''); setNotice('')
    try {
      const connection=await prepareWhatsAppConnection(provider)
      setWhatsApp(connection)
      setNotice(provider==='evolution'
        ? 'Organização preparada. O QR será liberado depois que o servidor Evolution e sua chave forem configurados com segurança.'
        : 'Organização preparada para a API oficial da Meta. Ainda será necessário cadastrar o número e aprovar os modelos de mensagem.')
    } catch(err) { setError(err instanceof Error?err.message:'Não foi possível preparar a conexão.') }
  }

  return <><div className="page-heading"><div><span className="badge">CRM omnichannel</span><h1>Integrações e canais</h1><p className="muted">Centralize mensagens autorizadas e registre a origem de cada conversa.</p></div><button className="btn btn-secondary"><RefreshCw/> Sincronizar canais</button></div>
    <div className="integration-policy"><ShieldCheck/><div><strong>Integrações consentidas</strong><span>Cada rede depende de conta comercial, aprovação e permissões. O CRM não captura mensagens fora dessas regras.</span></div></div>
    {error&&<div className="alert" style={{marginTop:18}}>{error}</div>}
    {notice&&<div className="success-banner" style={{marginTop:18}}>{notice}</div>}
    <section className="card" style={{marginTop:18}}>
      <div className="section-heading"><div><h2>WhatsApp da organização</h2><p className="muted">Cada clínica ou profissional terá sua própria conexão e suas conversas separadas no CRM.</p></div><span className={`status-pill ${whatsApp?.status==='connected'?'status-success':''}`}>{whatsApp?.status==='connected'?'Conectado':'Não conectado'}</span></div>
      {whatsApp&&<div className="list-item"><span>Instância reservada</span><strong>{whatsApp.instance_name}</strong></div>}
      <div className="heading-actions" style={{marginTop:14}}>
        <button className="btn btn-primary" onClick={()=>prepare('meta_cloud')}><MessageCircle/> Preparar API oficial da Meta</button>
        <button className="btn btn-secondary" onClick={()=>prepare('evolution')}><MessageCircle/> Preparar QR via Evolution</button>
      </div>
      <p className="muted" style={{marginTop:12}}>A Evolution API usa uma conexão não oficial baseada no WhatsApp Web e pode sofrer desconexões ou bloqueios. Nenhum disparo automático é ativado nesta etapa.</p>
    </section>
    <div className="grid grid-2 social-channel-grid">{channels.map(({name,icon:Icon,status,account,copy})=>{const active=connected.includes(name);return <article className="card social-channel-card" key={name}><div className="social-channel-icon"><Icon/></div><div><div className="row"><h2>{name}</h2>{active&&<span className="status-pill status-success"><CheckCircle2/> Preparado</span>}</div><p>{copy}</p><small>{account}</small></div><button className={`btn ${active?'btn-secondary':'btn-primary'}`} onClick={()=>setConnected(active?connected.filter(x=>x!==name):[...connected,name])}>{active?'Gerenciar preparação':status}</button></article>})}</div>
    <div className="grid grid-2" style={{marginTop:18}}><section className="card"><div className="section-heading"><div><h2>Roteamento para o CRM</h2><p className="muted">Regras aplicadas quando uma nova mensagem chega.</p></div><Webhook/></div>{[['Criar oportunidade automaticamente','Planejado'],['Registrar canal e origem','Planejado'],['Distribuir para atendente disponível','Planejado'],['Unificar pelo mesmo telefone','Planejado']].map(([label,status])=><div className="list-item" key={label}><span>{label}</span><span className="badge">{status}</span></div>)}</section><section className="card"><h2>Estado da integração</h2><div className="empty-inline">Os indicadores reais aparecerão depois que o primeiro canal estiver conectado.</div></section></div>
  </>
}
