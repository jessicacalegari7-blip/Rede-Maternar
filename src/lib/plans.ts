export type ProfessionalPlan = 'free' | 'marketplace' | 'independent' | 'clinic' | 'business' | 'annual'

export const planLabels: Record<ProfessionalPlan, string> = {
  free: 'Marketplace Gratuito',
  marketplace: 'Marketplace Ilimitado',
  independent: 'Profissional Independente',
  clinic: 'Plano para Clínicas',
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
    'Visitas ilimitadas no perfil',
    'Serviços ilimitados',
    'Destaque nas buscas por especialidade',
    'Relatório completo de desempenho',
  ],
  independent: [
    'Marketplace Ilimitado, CRM e ERP',
    'Conta exclusiva para uma profissional',
    'Até 3 especialidades no perfil',
    'Agenda, atendimentos, financeiro e WhatsApp',
  ],
  clinic: [
    'Marketplace, CRM e ERP completos',
    'Profissionais e especialidades ilimitados',
    'Agendas, acessos e repasses individuais',
    'Gestão de equipe, recepção e financeiro',
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
