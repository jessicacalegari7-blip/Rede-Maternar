import {useEffect} from 'react'
import {useLocation} from 'react-router-dom'
import {initializeMetaPixel,marketingAttribution,trackMarketingEvent} from '../lib/marketing'

export function MarketingTracking(){
  const location=useLocation()
  useEffect(()=>{
    const track=()=>{initializeMetaPixel();marketingAttribution();void trackMarketingEvent('PageView',{},{});if(location.pathname==='/premium')void trackMarketingEvent('ViewContent',{content_name:'Perfil Premium MaterPlace',content_type:'product',value:99.9,currency:'BRL'})}
    track();window.addEventListener('materplace:marketing-consent',track)
    return()=>window.removeEventListener('materplace:marketing-consent',track)
  },[location.pathname,location.search])
  return null
}

