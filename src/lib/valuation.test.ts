import { describe, expect, it } from 'vitest'
import {
  computeFairValue,
  ddm,
  fairValuePerPbv,
  grahamNumber,
  marginOfSafety,
  simpleDcf,
} from './valuation'

describe('grahamNumber', () => {
  it('computes sqrt(22.5 * EPS * BVPS)', () => {
    // 22.5 * 100 * 400 = 900,000 -> sqrt = ~948.68
    expect(grahamNumber({ eps: 100, bvps: 400 })).toBeCloseTo(948.68, 1)
  })

  it('returns null for non-positive EPS/BVPS', () => {
    expect(grahamNumber({ eps: -10, bvps: 400 })).toBeNull()
    expect(grahamNumber({ eps: 0, bvps: 400 })).toBeNull()
  })
})

describe('fairValuePerPbv', () => {
  it('computes EPS * target PER', () => {
    expect(fairValuePerPbv({ basis: 'per', eps: 500, targetMultiple: 15 })).toBe(7500)
  })

  it('computes BVPS * target PBV', () => {
    expect(fairValuePerPbv({ basis: 'pbv', bvps: 2000, targetMultiple: 2 })).toBe(4000)
  })

  it('returns null when required input missing', () => {
    expect(fairValuePerPbv({ basis: 'per', targetMultiple: 15 })).toBeNull()
  })
})

describe('simpleDcf', () => {
  it('discounts projected FCF plus terminal value', () => {
    const value = simpleDcf({
      fcf: 1000,
      growthRate: 0.1,
      discountRate: 0.12,
      terminalGrowth: 0.03,
      years: 5,
    })
    expect(value).not.toBeNull()
    expect(value!).toBeGreaterThan(0)
  })

  it('returns null when discount rate does not exceed terminal growth', () => {
    expect(
      simpleDcf({ fcf: 1000, growthRate: 0.1, discountRate: 0.03, terminalGrowth: 0.05 })
    ).toBeNull()
  })
})

describe('ddm', () => {
  it('computes D1 / (r - g)', () => {
    expect(ddm({ nextDividend: 100, discountRate: 0.1, growthRate: 0.04 })).toBeCloseTo(1666.67, 1)
  })

  it('returns null when discount rate does not exceed growth', () => {
    expect(ddm({ nextDividend: 100, discountRate: 0.04, growthRate: 0.05 })).toBeNull()
  })
})

describe('computeFairValue', () => {
  it('dispatches to the right method', () => {
    const value = computeFairValue({ method: 'graham', asumsi: { eps: 100, bvps: 400 } })
    expect(value).toBeCloseTo(948.68, 1)
  })
})

describe('marginOfSafety', () => {
  it('is positive when price is below fair value (undervalued)', () => {
    expect(marginOfSafety(1000, 800)).toBeCloseTo(0.2, 5)
  })

  it('is negative when price is above fair value (overvalued)', () => {
    expect(marginOfSafety(1000, 1200)).toBeCloseTo(-0.2, 5)
  })
})
