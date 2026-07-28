export type AttendanceMode = 'online' | 'office' | 'home'

export interface ProfessionalService {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  modes: AttendanceMode[]
  active: boolean
}

export interface WeeklyAvailability {
  weekday: number
  enabled: boolean
  start: string
  end: string
}

export interface ProfessionalProfile {
  userId: string
  slug: string
  displayName: string
  headline: string
  specialty: string
  registration: string
  city: string
  about: string
  phone: string
  instagram: string
  website: string
  yearsExperience: number
  acceptsNewPatients: boolean
  services: ProfessionalService[]
  availability: WeeklyAvailability[]
}

const PROFILE_KEY = 'rede-maternar:professional-profiles'

const defaultAvailability: WeeklyAvailability[] = [
  { weekday: 1, enabled: true, start: '09:00', end: '18:00' },
  { weekday: 2, enabled: true, start: '09:00', end: '18:00' },
  { weekday: 3, enabled: true, start: '09:00', end: '18:00' },
  { weekday: 4, enabled: true, start: '09:00', end: '18:00' },
  { weekday: 5, enabled: true, start: '09:00', end: '16:00' },
  { weekday: 6, enabled: false, start: '09:00', end: '13:00' },
  { weekday: 0, enabled: false, start: '09:00', end: '13:00' },
]

const seedProfiles: ProfessionalProfile[] = [
  {
    userId: 'professional-1',
    slug: 'marina-lopes',
    displayName: 'Dra. Marina Lopes',
    headline: 'Fonoaudióloga materno-infantil com atendimento acolhedor e baseado em evidências.',
    specialty: 'Fonoaudiologia materno-infantil',
    registration: 'CRFa 2-00000',
    city: 'São Paulo, SP',
    about: 'Acompanho gestantes, mães e bebês em desafios relacionados à sucção, oralidade e desenvolvimento infantil. Meu atendimento une escuta cuidadosa, avaliação individual e um plano possível para a rotina de cada família.',
    phone: '(11) 99999-0000',
    instagram: '@dramarinalopes',
    website: '',
    yearsExperience: 8,
    acceptsNewPatients: true,
    services: [
      {
        id: 'service-1',
        name: 'Avaliação fonoaudiológica do bebê',
        description: 'Avaliação completa de sucção, mobilidade oral e dinâmica da mamada, com orientações por escrito.',
        durationMinutes: 60,
        price: 390,
        modes: ['office'],
        active: true,
      },
      {
        id: 'service-2',
        name: 'Acompanhamento on-line',
        description: 'Retorno para revisão do plano, evolução e novos ajustes.',
        durationMinutes: 40,
        price: 250,
        modes: ['online'],
        active: true,
      },
    ],
    availability: defaultAvailability,
  },
]

function storageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function getProfiles(): ProfessionalProfile[] {
  if (!storageAvailable()) return seedProfiles
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(seedProfiles))
    return seedProfiles
  }
  try {
    return JSON.parse(raw) as ProfessionalProfile[]
  } catch {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(seedProfiles))
    return seedProfiles
  }
}

export function getProfileByUserId(userId: string) {
  return getProfiles().find((profile) => profile.userId === userId) ?? null
}

export function getProfileBySlug(slug: string) {
  return getProfiles().find((profile) => profile.slug === slug) ?? null
}

export function makeDefaultProfile(userId: string, name: string, specialty = '', city = '', registration = ''): ProfessionalProfile {
  return {
    userId,
    slug: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    displayName: name,
    headline: '',
    specialty,
    registration,
    city,
    about: '',
    phone: '',
    instagram: '',
    website: '',
    yearsExperience: 0,
    acceptsNewPatients: true,
    services: [],
    availability: defaultAvailability,
  }
}

export function saveProfile(profile: ProfessionalProfile) {
  const profiles = getProfiles()
  const index = profiles.findIndex((item) => item.userId === profile.userId)
  const updated = index >= 0 ? profiles.map((item) => item.userId === profile.userId ? profile : item) : [profile, ...profiles]
  if (storageAvailable()) localStorage.setItem(PROFILE_KEY, JSON.stringify(updated))
  return profile
}

export const weekdayLabels: Record<number, string> = {
  0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado',
}

export const modeLabels: Record<AttendanceMode, string> = {
  online: 'On-line', office: 'Consultório', home: 'Domiciliar',
}
