import { describe, expect, it } from 'vitest'
import { xirr } from './xirr'

describe('xirr', () => {
  it('returns ~10% for a single deposit growing to 110% after exactly one year', () => {
    const rate = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2026-01-01'), amount: 1100 },
    ])
    expect(rate).not.toBeNull()
    expect(rate!).toBeCloseTo(0.1, 2)
  })

  it('returns ~0% when money in equals money out with no growth', () => {
    const rate = xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2025-07-01'), amount: -500 },
      { date: new Date('2026-01-01'), amount: 1500 },
    ])
    expect(rate).not.toBeNull()
    expect(rate!).toBeCloseTo(0, 2)
  })

  it('returns null when all cash flows have the same sign', () => {
    expect(xirr([
      { date: new Date('2025-01-01'), amount: -1000 },
      { date: new Date('2025-06-01'), amount: -500 },
    ])).toBeNull()
  })

  it('returns null with fewer than 2 cash flows', () => {
    expect(xirr([{ date: new Date(), amount: -1000 }])).toBeNull()
  })

  it('handles multiple deposits and a final terminal value (portfolio-style)', () => {
    const rate = xirr([
      { date: new Date('2024-01-01'), amount: -1_000_000 },
      { date: new Date('2024-07-01'), amount: -500_000 },
      { date: new Date('2026-01-01'), amount: 1_800_000 },
    ])
    expect(rate).not.toBeNull()
    // Positive return: put in 1.5M total, got back 1.8M over ~1-2 years
    expect(rate!).toBeGreaterThan(0)
    expect(rate!).toBeLessThan(1)
  })
})
