import { useEffect, useState } from 'react'
import { MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { getWhatsAppQrCode, listWhatsAppConnections, prepareWhatsAppConnection, refreshWhatsAppStatus, type WhatsAppConnection } from '../../lib/operations'

export function SocialIntegrations(){
  const [instances,setInstances]=useState<WhatsAppConnection[]>([])
  const [qr,setQr]=useState(''); const [notice,setNotice]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  const load=async()=>{try{setInstances(await listWhatsAppConnections())}catch(e){setError(e instanceof Error?e.message:'Falha ao consultar conexões.')}}
  useEffect(()=>{void load()},[])
  const showQr=async(id:string)=>{setBusy(true);setError('');try{const result=await getWhatsAppQrCode(id);setQr(result.code||'');if(!result.code)setNotice('O servidor ainda não retornou um QR Code. Atualize o status e tente novamente.')}catch(e){setError(e instanceof Error?e.message:'Falha ao gerar QR Code.')}finally{setBusy(false)}}
  const create=async()=>{setBusy(true);setError('');setNotice('');try{const connection=await prepareWhatsAppConnection('evolution');await load();await showQr(connection.id)}catch(e){setError(e instanceof Error?e.message:'Não foi possível criar a instância.')}finally{setBusy(false)}}
  return <>
    <div className="page-heading"><div><span className="badge">CRM omnichannel</span><h1>Integrações e canais</h1><p className="muted">Conecte os números de WhatsApp da organização sem expor credenciais no navegador.</p></div><button className="btn btn-secondary" onClick={()=>void load()}><RefreshCw/>Sincronizar</button></div>
    <div className="integration-policy"><ShieldCheck/><div><strong>Conexão isolada por organização</strong><span>Cada clínica pode possuir uma ou mais instâncias. Somente gestores da organização podem conectar números.</span></div></div>
    {error&&<div className="alert alert-error" style={{marginTop:18}}>{error}</div>}{notice&&<div className="success-banner" style={{marginTop:18}}>{notice}</div>}
    <section className="card" style={{marginTop:18}}><div className="section-heading"><div><h2>WhatsApp via Evolution API</h2><p className="muted">A Evolution API permanece hospedada na VPS; a MaterPlace acessa o serviço pela API segura da Vercel.</p></div><button disabled={busy} className="btn btn-primary" onClick={()=>void create()}><MessageCircle/>Conectar novo número</button></div>
      {instances.map(instance=><div className="list-item" key={instance.id}><span><strong>{instance.instance_name}</strong><small>{instance.phone_number||'Número ainda não identificado'}</small></span><span className={`status-pill ${instance.status==='connected'?'status-success':''}`}>{instance.status}</span><button className="btn btn-secondary btn-small" onClick={async()=>{await refreshWhatsAppStatus(instance.id);await load()}}>Atualizar</button>{instance.status!=='connected'&&<button className="btn btn-secondary btn-small" onClick={()=>void showQr(instance.id)}>Exibir QR</button>}</div>)}
      {!instances.length&&<div className="empty-inline">Nenhum WhatsApp conectado nesta organização.</div>}
      {qr&&<div style={{textAlign:'center',padding:20}}><img src={qr.startsWith('data:')?qr:`data:image/png;base64,${qr}`} alt="QR Code do WhatsApp" style={{width:280,maxWidth:'100%'}}/><p>Abra o WhatsApp → Aparelhos conectados → Conectar aparelho.</p></div>}
    </section>
    <section className="card" style={{marginTop:18}}><h2>Segurança e disponibilidade</h2><p className="muted">A integração por WhatsApp Web pode desconectar ou sofrer bloqueio do provedor. O sistema registra erros e permite reconexão por QR. A API oficial da Meta poderá ser oferecida separadamente.</p></section>
  </>
}
