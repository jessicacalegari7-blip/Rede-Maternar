export function publicImageUrl(value:string|null|undefined,width=1200){
  if(!value)return''
  try{
    const url=new URL(value,window.location.origin)
    if(!url.pathname.startsWith('/storage/v1/object/public/'))return value
    return `/api/public-image?src=${encodeURIComponent(url.toString())}&w=${Math.min(Math.max(width,160),1600)}`
  }catch{return value}
}
