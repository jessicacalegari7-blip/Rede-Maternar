export type ProfessionalPlan = 'free' | 'annual'
export const planLabels:Record<ProfessionalPlan,string>={free:'Plano Comunidade',annual:'Plano Anual'}
export const planFeatures={
  free:['Criar perfil básico','Buscar profissionais','Indicar pacientes','Receber 15% do líquido após gateway em indicações convertidas'],
  annual:['Tudo do Plano Comunidade','Receber indicações','Agenda e portal da paciente','Chat, prontuário e planos de cuidados','Pagamentos, carteira e relatórios'],
}
export function isAnnual(plan?:ProfessionalPlan){return plan==='annual'}
