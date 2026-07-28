export type PaymentMethod = 'pix' | 'credit_card_single' | 'credit_card_installments'

export interface FinancialSplit {
  grossCents: number
  paymentFeeCents: number
  gatewayNetCents: number
  referralCommissionCents: number
  platformRevenueCents: number
  professionalNetCents: number
}

const PAYMENT_RATE_BPS: Record<PaymentMethod, number> = {
  pix: 100,
  credit_card_single: 500,
  credit_card_installments: 1000,
}
const REFERRAL_RATE_BPS = 1500
const PLATFORM_RATE_BPS = 800

/** Arredondamento oficial: metade para cima, em cada parcela, sempre em centavos. */
function percentage(cents: number, basisPoints: number) {
  return Math.floor((cents * basisPoints + 5000) / 10000)
}

export function calculateFinancialSplit(
  grossCents: number,
  method: PaymentMethod,
  hasPaidReferral: boolean,
): FinancialSplit {
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) {
    throw new Error('O valor bruto deve ser um inteiro não negativo em centavos.')
  }
  const paymentFeeCents = percentage(grossCents, PAYMENT_RATE_BPS[method])
  const gatewayNetCents = grossCents - paymentFeeCents
  const referralCommissionCents = hasPaidReferral ? percentage(gatewayNetCents, REFERRAL_RATE_BPS) : 0
  const platformRevenueCents = percentage(gatewayNetCents, PLATFORM_RATE_BPS)
  const professionalNetCents =
    grossCents - paymentFeeCents - referralCommissionCents - platformRevenueCents
  return {
    grossCents, paymentFeeCents, gatewayNetCents, referralCommissionCents,
    platformRevenueCents, professionalNetCents,
  }
}

export function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
