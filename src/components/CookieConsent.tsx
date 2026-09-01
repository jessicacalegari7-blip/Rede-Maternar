import { useState } from 'react'
import { Link } from 'react-router-dom'

export function CookieConsent(){
  const [visible,setVisible]=useState(()=>!localStorage.getItem('materplace-cookie-consent'))
  if(!visible)return null
  function choose(value:'accepted'|'essential'){
    localStorage.setItem('materplace-cookie-consent',value)
    const consent=value==='accepted'?'granted':'denied'
    const gtag=(window as typeof window & {gtag?:(...args:unknown[])=>void}).gtag
    gtag?.('consent','update',{analytics_storage:consent,ad_storage:consent,ad_user_data:consent,ad_personalization:consent})
    setVisible(false)
  }
  return <section className="cookie-consent" aria-labelledby="cookie-consent-title"><p><strong id="cookie-consent-title">Sua privacidade importa.</strong> Usamos cookies essenciais e, com sua autorização, Analytics e publicidade. <Link to="/cookies">Saiba mais</Link>.</p><div><button type="button" className="btn btn-secondary" onClick={()=>choose('essential')}>Somente essenciais</button><button type="button" className="btn btn-primary" onClick={()=>choose('accepted')}>Aceitar opcionais</button></div></section>
}
