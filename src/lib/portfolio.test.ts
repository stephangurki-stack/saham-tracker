import { describe, expect, it } from 'vitest'
import {
  aggregateHoldingsByTicker,
  computeCostBasisTimeline,
  computeHoldingsBySecurity,
  unrealizedGain,
} from './portfolio'
import type { Transaction } from './types'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    security_id: 'sec-a',
    ticker: 'BBCA',
    tipe: 'buy',
    tanggal: '2026-01-01',
    harga: 9000,
    lot: 10,
    fee: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeHoldingsBySecurity', () => {
  it('computes weighted average buy price across two buys', () => {
    const transactions = [
      tx({ harga: 9000, lot: 10, tanggal: '2026-01-01' }),
      tx({ harga: 9200, lot: 10, tanggal: '2026-01-05' }),
    ]
    const [holding] = computeHoldingsBySecurity(transactions)
    expect(holding.lot).toBe(20)
    expect(holding.avgBuyPrice).toBeCloseTo(9100)
  })

  it('books realized gain on sell without changing avg price of remaining lot', () => {
    const transactions = [
      tx({ harga: 9000, lot: 10, tanggal: '2026-01-01' }),
      tx({ tipe: 'sell', harga: 9500, lot: 4, tanggal: '2026-01-10', fee: 5000 }),
    ]
    const [holding] = computeHoldingsBySecurity(transactions)
    expect(holding.lot).toBe(6)
    expect(holding.avgBuyPrice).toBeCloseTo(9000)
    // (9500 - 9000) * 4 * 100 - 5000 fee = 200000 - 5000
    expect(holding.realizedGain).toBeCloseTo(195000)
  })

  it('keeps separate positions per security account for the same ticker', () => {
    const transactions = [
      tx({ security_id: 'sec-a', harga: 9000, lot: 10 }),
      tx({ security_id: 'sec-b', harga: 9500, lot: 5 }),
    ]
    const holdings = computeHoldingsBySecurity(transactions)
    expect(holdings).toHaveLength(2)
  })
})

describe('aggregateHoldingsByTicker', () => {
  it('merges holdings from multiple securities into one gabungan position', () => {
    const transactions = [
      tx({ security_id: 'sec-a', harga: 9000, lot: 10 }),
      tx({ security_id: 'sec-b', harga: 9500, lot: 10 }),
    ]
    const holdings = computeHoldingsBySecurity(transactions)
    const [combined] = aggregateHoldingsByTicker(holdings)
    expect(combined.lot).toBe(20)
    expect(combined.avgBuyPrice).toBeCloseTo(9250)
  })
})

describe('unrealizedGain', () => {
  it('scales by lot size (1 lot = 100 shares)', () => {
    const [holding] = computeHoldingsBySecurity([tx({ harga: 9000, lot: 10 })])
    expect(unrealizedGain(holding, 9500)).toBeCloseTo((9500 - 9000) * 10 * 100)
  })
})

describe('computeCostBasisTimeline', () => {
  it('tracks total cost basis growing on buys and shrinking on sells', () => {
    const transactions = [
      tx({ harga: 9000, lot: 10, tanggal: '2026-01-01' }),
      tx({ harga: 9500, lot: 5, tanggal: '2026-01-05' }),
      tx({ tipe: 'sell', harga: 9800, lot: 5, tanggal: '2026-01-10' }),
    ]
    const timeline = computeCostBasisTimeline(transactions)
    expect(timeline).toHaveLength(3)
    expect(timeline[0].totalCostBasis).toBeCloseTo(9000 * 10 * 100)
    expect(timeline[1].totalCostBasis).toBeCloseTo(9000 * 10 * 100 + 9500 * 5 * 100)
    // after selling 5 lots at the blended avg price, cost basis drops proportionally
    expect(timeline[2].totalCostBasis).toBeLessThan(timeline[1].totalCostBasis)
  })
})
