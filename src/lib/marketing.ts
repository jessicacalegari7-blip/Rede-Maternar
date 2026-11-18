export type MarketingEventName='PageView'|'ViewContent'|'Lead'|'CompleteRegistration'|'InitiateCheckout'|'Purchase'

const consentKey='materplace-cookie-consent'
const sessionKey='materplace-marketing-session'

function marketingAllowed(){return localStorage.getItem(consentKey)==='accepted'}
function marketingConfigured(){return import.meta.env.VITE_META_TRACKING_ENABLED==='true'&&Boolean(String(import.meta.env.VITE_META_PIXEL_ID||'').trim())}
function randomId(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}
function sessionId(){let value=sessionStorage.getItem(sessionKey);if(!value){value=randomId();sessionStorage.setItem(sessionKey,value)}return value}
function cookie(name:string){return document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)||''}
function clean(value:string|null,max=160){return String(value||'').trim().slice(0,max)}

export function marketingAttribution(){
  if(!marketingAllowed())return {marketing_consent:false}
  const params=new URLSearchParams(location.search),fbclid=clean(params.get('fbclid'),240)
  let stored:Record<string,string>={}
  try{stored=JSON.parse(sessionStorage.getItem('materplace-marketing-attribution')||'{}') as Record<string,string>}catch{sessionStorage.removeItem('materplace-marketing-attribution')}
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','campaign_id'] as const){const value=clean(params.get(key));if(value)stored[key]=value}
  if(fbclid){stored.fbclid=fbclid;stored.fbc=`fb.1.${Date.now()}.${fbclid}`}
  const fbp=clean(cookie('_fbp'),240),fbc=clean(cookie('_fbc'),300)||stored.fbc
  if(fbp)stored.fbp=fbp;if(fbc)stored.fbc=fbc
  sessionStorage.setItem('materplace-marketing-attribution',JSON.stringify(stored))
  return {...stored,marketing_consent:true,session_id:sessionId()}
}

declare global{interface Window{fbq?:(...args:unknown[])=>void;_fbq?:unknown}}

export function initializeMetaPixel(){
  const pixelId=String(import.meta.env.VITE_META_PIXEL_ID||'').trim()
  if(!marketingConfigured()||!pixelId||!marketingAllowed()||window.fbq)return false
  const fbq=((...args:unknown[])=>{(fbq as unknown as {queue:unknown[]}).queue.push(args)}) as typeof window.fbq
  Object.assign(fbq,{queue:[],loaded:true,version:'2.0'})
  window.fbq=fbq;window._fbq=fbq
  const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/pt_BR/fbevents.js';document.head.appendChild(script)
  fbq?.('consent','grant');fbq?.('init',pixelId)
  return true
}

export async function trackMarketingEvent(name:MarketingEventName,customData:Record<string,unknown>={},options:{eventId?:string;server?:boolean}={}){
  if(!marketingAllowed()||!marketingConfigured())return null
  initializeMetaPixel()
  const eventId=options.eventId||`${name.toLowerCase()}:${randomId()}`
  window.fbq?.('track',name,customData,{eventID:eventId})
  if(options.server!==false)fetch('/api/marketing-event',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({eventId,eventName:name,sourceUrl:location.href,attribution:marketingAttribution(),customData})}).catch(()=>undefined)
  return eventId
}

export function notifyMarketingConsent(){window.dispatchEvent(new CustomEvent('materplace:marketing-consent'))}

