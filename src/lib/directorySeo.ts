export const slugifyDirectory=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')

export type DirectorySeoProfile={
  id:string
  name:string
  specialty_slug:string
  primary_specialty:string
  state_code:string
  city_slug:string
  city:string
  professional_registration?:string|null
}

export const directoryListingPath=(specialty:string,state:string,city:string)=>
  `/profissionais/${slugifyDirectory(specialty)}/${state.toLowerCase()}/${slugifyDirectory(city)}`

export const directoryProfilePath=(profile:DirectorySeoProfile)=>{
  const registration=profile.professional_registration?`-${slugifyDirectory(profile.professional_registration)}`:''
  return `${directoryListingPath(profile.specialty_slug,profile.state_code,profile.city_slug)}/${slugifyDirectory(profile.name)}${registration}-${profile.id}`
}
