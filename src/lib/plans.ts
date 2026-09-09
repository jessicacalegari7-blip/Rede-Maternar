export type ProfessionalPlan = 'free' | 'marketplace' | 'independent' | 'clinic' | 'business' | 'annual'

export const planLabels: Record<ProfessionalPlan, string> = {
  free: 'Marketplace Gratuito',
  marketplace: 'Plano Essencial',
  independent: 'Profissional Individual',
  clinic: 'Clínica',
  business: 'Plano para Clínicas',
  annual: 'Plano para Clínicas',
}

export const planFeatures: Record<ProfessionalPlan, string[]> = {
  free: [
    'Perfil profissional verificado',
    'Até 30 visitas mensais no perfil',
    'Publicação de até 3 serviços',
    'Relatório básico de visualizações',
  ],
  marketplace: [
    'Perfil público para uma profissional',
    '1 especialidade no diretório',
    'Presença nas buscas da MaterPlace',
  ],
  independent: [
    'Marketplace, CRM e ERP',
    'Conta exclusiva para uma profissional',
    'Até 3 especialidades no perfil',
    'CRM para organizar contatos e agenda',
    'ERP para controlar o financeiro',
  ],
  clinic: [
    'Marketplace, CRM e ERP completos',
    'Profissionais e especialidades ilimitados',
    'Agendas, acessos e repasses individuais',
    'Gestão de equipe, recepção e financeiro',
    'Integrações externas podem ter custo próprio',
  ],
  business: [
    'Tudo do Marketplace Ilimitado',
    'CRM com funil e gestão de clientes',
    'Agenda, tarefas e automações',
    'ERP financeiro, serviços e relatórios',
    'Central de atendimento com WhatsApp Business',
    'Múltiplos profissionais, agendas e acessos para clínicas',
  ],
  annual: [
    'Tudo do Marketplace Ilimitado',
    'CRM com funil e gestão de clientes',
    'Agenda, tarefas e automações',
    'ERP financeiro, serviços e relatórios',
    'Central de atendimento com WhatsApp Business',
    'Múltiplos profissionais, agendas e acessos para clínicas',
  ],
}

export function hasManagement(plan?: ProfessionalPlan) {
  return plan === 'independent' || plan === 'clinic' || plan === 'business'
}

export function isClinicPlan(plan?: ProfessionalPlan) {
  return plan === 'clinic' || plan === 'business' || plan === 'annual'
}

export function specialtyLimitForPlan(plan?: ProfessionalPlan): number | null {
  if (isClinicPlan(plan)) return null
  return plan === 'independent' ? 3 : 1
}
