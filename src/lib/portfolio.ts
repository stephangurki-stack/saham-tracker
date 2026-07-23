import type { CashFlow, Dividend, Holding, Transaction } from './types'

/** IDX: 1 lot = 100 shares. `harga` is quoted per share; `lot` is quantity in lots. */
export const LOT_SIZE = 100

interface RunningPosition {
  ticker: string
  security_id: string
  lot: number
  avgBuyPrice: number
  realizedGain: number
}

function sortByDateThenCreatedAt(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const dateDiff = a.tanggal.localeCompare(b.tanggal)
    if (dateDiff !== 0) return dateDiff
    return a.created_at.localeCompare(b.created_at)
  })
}

/**
 * Replays buy/sell transactions per (security_id, ticker) in chronological
 * order to derive current lot held, weighted-average buy price (per share),
 * and cumulative realized gain/loss. Avg buy price only changes on buys;
 * sells reduce lot and book realized gain against the avg price at time of
 * sale, so remaining lots keep their existing avg price.
 */
export function computeHoldingsBySecurity(transactions: Transaction[]): Holding[] {
  const positions = new Map<string, RunningPosition>()

  for (const tx of sortByDateThenCreatedAt(transactions)) {
    const key = `${tx.security_id}:${tx.ticker}`
    const pos = positions.get(key) ?? {
      ticker: tx.ticker,
      security_id: tx.security_id,
      lot: 0,
      avgBuyPrice: 0,
      realizedGain: 0,
    }

    if (tx.tipe === 'buy') {
      const costBefore = pos.avgBuyPrice * pos.lot * LOT_SIZE
      const costThisBuy = tx.harga * tx.lot * LOT_SIZE + tx.fee
      const newLot = pos.lot + tx.lot
      pos.avgBuyPrice = newLot > 0 ? (costBefore + costThisBuy) / (newLot * LOT_SIZE) : 0
      pos.lot = newLot
    } else {
      const sellLot = Math.min(tx.lot, pos.lot)
      const proceeds = tx.harga * sellLot * LOT_SIZE - tx.fee
      const costOfSold = pos.avgBuyPrice * sellLot * LOT_SIZE
      pos.realizedGain += proceeds - costOfSold
      pos.lot -= sellLot
      if (pos.lot === 0) pos.avgBuyPrice = 0
    }

    positions.set(key, pos)
  }

  return Array.from(positions.values()).map((pos) => ({
    ticker: pos.ticker,
    security_id: pos.security_id,
    lot: pos.lot,
    avgBuyPrice: pos.avgBuyPrice,
    costBasis: pos.avgBuyPrice * pos.lot * LOT_SIZE,
    realizedGain: pos.realizedGain,
  }))
}

/** Combines per-security holdings into one gabungan position per ticker. */
export function aggregateHoldingsByTicker(holdings: Holding[]): Holding[] {
  const combined = new Map<string, Holding>()

  for (const h of holdings) {
    const existing = combined.get(h.ticker)
    if (!existing) {
      combined.set(h.ticker, { ...h, security_id: 'gabungan' })
      continue
    }
    const totalLot = existing.lot + h.lot
    const totalCost = existing.costBasis + h.costBasis
    existing.lot = totalLot
    existing.avgBuyPrice = totalLot > 0 ? totalCost / (totalLot * LOT_SIZE) : 0
    existing.costBasis = totalCost
    existing.realizedGain += h.realizedGain
  }

  return Array.from(combined.values())
}

export function marketValue(holding: Holding, currentPrice: number): number {
  return currentPrice * holding.lot * LOT_SIZE
}

export function unrealizedGain(holding: Holding, currentPrice: number): number {
  return (currentPrice - holding.avgBuyPrice) * holding.lot * LOT_SIZE
}

export function unrealizedGainPct(holding: Holding, currentPrice: number): number {
  if (holding.avgBuyPrice === 0) return 0
  return (currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice
}

export function portfolioWeights(
  holdings: Holding[],
  prices: Record<string, number>
): Map<string, number> {
  const values = holdings.map((h) => marketValue(h, prices[h.ticker] ?? 0))
  const total = values.reduce((sum, v) => sum + v, 0)
  const weights = new Map<string, number>()
  holdings.forEach((h, i) => {
    weights.set(h.ticker, total > 0 ? values[i] / total : 0)
  })
  return weights
}

export interface CostBasisPoint {
  tanggal: string
  totalCostBasis: number
}

/**
 * Total cost basis (modal diinvestasikan yang masih tertanam) setelah setiap
 * transaksi, diurutkan kronologis. Tidak memerlukan riwayat harga pasar —
 * hanya menandai berapa modal yang tertanam dari waktu ke waktu, bukan nilai
 * pasar historis (yang butuh data harga historis per ticker, di luar scope MVP).
 */
export function computeCostBasisTimeline(transactions: Transaction[]): CostBasisPoint[] {
  const sorted = sortByDateThenCreatedAt(transactions)
  const points: CostBasisPoint[] = []

  for (let i = 0; i < sorted.length; i++) {
    const upTo = sorted.slice(0, i + 1)
    const holdings = computeHoldingsBySecurity(upTo)
    const totalCostBasis = holdings.reduce((sum, h) => sum + h.costBasis, 0)
    points.push({ tanggal: sorted[i].tanggal, totalCostBasis })
  }

  return points
}

/**
 * Cash sitting in the brokerage account: deposits minus withdrawals, minus
 * money spent on buys (incl. fee), plus proceeds from sells (net of fee),
 * plus dividends received (they land as cash, not as stock). All three
 * arrays should already be scoped to the same security (or all securities
 * for the portfolio-wide figure) before calling this.
 */
export function computeCashBalance(
  transactions: Transaction[],
  cashFlows: CashFlow[],
  dividends: Dividend[]
): number {
  const deposits = cashFlows.filter((c) => c.tipe === 'deposit').reduce((sum, c) => sum + c.jumlah, 0)
  const withdrawals = cashFlows.filter((c) => c.tipe === 'withdraw').reduce((sum, c) => sum + c.jumlah, 0)
  const buyCost = transactions
    .filter((t) => t.tipe === 'buy')
    .reduce((sum, t) => sum + t.harga * t.lot * LOT_SIZE + t.fee, 0)
  const sellProceeds = transactions
    .filter((t) => t.tipe === 'sell')
    .reduce((sum, t) => sum + t.harga * t.lot * LOT_SIZE - t.fee, 0)
  const dividendsReceived = dividends.reduce((sum, d) => sum + d.total, 0)

  return deposits - withdrawals - buyCost + sellProceeds + dividendsReceived
}
