export type ProfessionalPlan = 'free' | 'marketplace' | 'business' | 'annual'

export const planLabels: Record<ProfessionalPlan, string> = {
  free: 'Marketplace Gratuito',
  marketplace: 'Marketplace Ilimitado',
  business: 'Gestão Completa',
  annual: 'Gestão Completa',
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
  return plan === 'business'
}
