import { describe, expect, it } from 'vitest'
import { calculateFinancialSplit } from './financial'

function expectBalanced(split: ReturnType<typeof calculateFinancialSplit>) {
  expect(split.paymentFeeCents + split.referralCommissionCents +
    split.platformRevenueCents + split.professionalNetCents).toBe(split.grossCents)
}

describe('serviço financeiro oficial', () => {
  it.each([
    ['pix', 450, 44550, 6683, 3564, 34303],
    ['credit_card_single', 2250, 42750, 6413, 3420, 32917],
    ['credit_card_installments', 4500, 40500, 6075, 3240, 31185],
  ] as const)('%s com indicação', (method, fee, gateway, referral, platform, professional) => {
    const result = calculateFinancialSplit(45000, method, true)
    expect(result).toMatchObject({
      paymentFeeCents: fee, gatewayNetCents: gateway,
      referralCommissionCents: referral, platformRevenueCents: platform,
      professionalNetCents: professional,
    })
    expectBalanced(result)
  })

  it('sem indicação remunera apenas gateway, plataforma e profissional', () => {
    const result = calculateFinancialSplit(45000, 'pix', false)
    expect(result.referralCommissionCents).toBe(0)
    expect(result.platformRevenueCents).toBe(3564)
    expect(result.professionalNetCents).toBe(40986)
    expectBalanced(result)
  })

  it('rejeita valores fracionários e preserva centavos em valores ímpares', () => {
    expect(() => calculateFinancialSplit(10.5, 'pix', true)).toThrow()
    expectBalanced(calculateFinancialSplit(101, 'credit_card_installments', true))
  })
})
