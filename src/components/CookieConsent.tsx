import { useState } from 'react'
import { Link } from 'react-router-dom'

export function CookieConsent(){
  const [visible,setVisible]=useState(()=>!localStorage.getItem('materplace-cookie-consent'))
  if(!visible)return null
  function choose(value:'accepted'|'essential'){localStorage.setItem('materplace-cookie-consent',value);setVisible(false)}
  return <aside className="cookie-consent" role="dialog" aria-label="Preferências de cookies"><p><strong>Sua privacidade importa.</strong> Usamos cookies essenciais e, com sua autorização, Analytics e publicidade. <Link to="/cookies">Saiba mais</Link>.</p><div><button className="btn btn-secondary" onClick={()=>choose('essential')}>Somente essenciais</button><button className="btn btn-primary" onClick={()=>choose('accepted')}>Aceitar opcionais</button></div></aside>
}
