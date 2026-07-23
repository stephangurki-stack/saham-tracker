import { describe, expect, it } from 'vitest'
import {
  aggregateHoldingsByTicker,
  computeCashBalance,
  computeCostBasisTimeline,
  computeHoldingsBySecurity,
  unrealizedGain,
} from './portfolio'
import type { CashFlow, Dividend, Transaction } from './types'

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

function cashFlow(overrides: Partial<CashFlow>): CashFlow {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    security_id: 'sec-a',
    tipe: 'deposit',
    tanggal: '2026-01-01',
    jumlah: 1000,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function dividend(overrides: Partial<Dividend>): Dividend {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    security_id: 'sec-a',
    ticker: 'BBCA',
    cum_date: null,
    ex_date: null,
    tanggal_bayar: '2026-01-01',
    jumlah_per_lembar: 10,
    lot: 10,
    total: 10000,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('computeCashBalance', () => {
  it('is deposits minus withdrawals when there are no trades or dividends', () => {
    const cash = computeCashBalance(
      [],
      [cashFlow({ tipe: 'deposit', jumlah: 10_000_000 }), cashFlow({ tipe: 'withdraw', jumlah: 2_000_000 })],
      []
    )
    expect(cash).toBeCloseTo(8_000_000)
  })

  it('subtracts buy cost (incl. fee) and adds sell proceeds (net of fee)', () => {
    const cash = computeCashBalance(
      [
        tx({ tipe: 'buy', harga: 9000, lot: 10, fee: 5000 }),
        tx({ tipe: 'sell', harga: 9500, lot: 4, fee: 3000 }),
      ],
      [cashFlow({ tipe: 'deposit', jumlah: 10_000_000 })],
      []
    )
    const buyCost = 9000 * 10 * 100 + 5000
    const sellProceeds = 9500 * 4 * 100 - 3000
    expect(cash).toBeCloseTo(10_000_000 - buyCost + sellProceeds)
  })

  it('adds dividends received as cash', () => {
    const cash = computeCashBalance([], [cashFlow({ tipe: 'deposit', jumlah: 1_000_000 })], [dividend({ total: 50_000 })])
    expect(cash).toBeCloseTo(1_050_000)
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
