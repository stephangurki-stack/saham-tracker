export interface CashFlow {
  date: Date
  amount: number
}

const DAY_MS = 1000 * 60 * 60 * 24
const MAX_ITERATIONS = 100
const TOLERANCE = 1e-7

function yearFraction(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS / 365
}

function npv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, cf) => sum + cf.amount / Math.pow(1 + rate, yearFraction(t0, cf.date)), 0)
}

function dNpv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, cf) => {
    const t = yearFraction(t0, cf.date)
    if (t === 0) return sum
    return sum - (t * cf.amount) / Math.pow(1 + rate, t + 1)
  }, 0)
}

/**
 * Solves for the annualized internal rate of return across irregularly-dated
 * cash flows (Newton-Raphson, falling back to bisection if it doesn't
 * converge). Returns null if there aren't at least one inflow and one
 * outflow, or no root is found in a sane range.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null
  const hasPositive = flows.some((f) => f.amount > 0)
  const hasNegative = flows.some((f) => f.amount < 0)
  if (!hasPositive || !hasNegative) return null

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const t0 = sorted[0].date

  let rate = 0.1
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const f = npv(rate, sorted, t0)
    const df = dNpv(rate, sorted, t0)
    if (Math.abs(df) < 1e-12) break
    const next = rate - f / df
    if (!Number.isFinite(next) || next <= -1) break
    if (Math.abs(next - rate) < TOLERANCE) return next
    rate = next
  }

  return bisection(sorted, t0)
}

function bisection(flows: CashFlow[], t0: Date): number | null {
  let low = -0.99
  let high = 10
  let fLow = npv(low, flows, t0)
  const fHigh = npv(high, flows, t0)
  if (Number.isNaN(fLow) || Number.isNaN(fHigh) || fLow * fHigh > 0) return null

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2
    const fMid = npv(mid, flows, t0)
    if (Math.abs(fMid) < TOLERANCE) return mid
    if (fLow * fMid < 0) {
      high = mid
    } else {
      low = mid
      fLow = fMid
    }
  }
  return (low + high) / 2
}
