export type ValuationMethod = 'graham' | 'per_pbv' | 'dcf' | 'ddm'

/** Margin of safety threshold above which a watchlist stock is flagged as a buy candidate. */
export const BUY_THRESHOLD_MOS = 0.3

export interface GrahamAssumptions {
  eps: number
  bvps: number
}

export interface PerPbvAssumptions {
  basis: 'per' | 'pbv'
  eps?: number
  bvps?: number
  targetMultiple: number
}

export interface DcfAssumptions {
  fcf: number
  growthRate: number
  discountRate: number
  terminalGrowth: number
  years?: number
}

export interface DdmAssumptions {
  nextDividend: number
  discountRate: number
  growthRate: number
}

export type ValuationAssumptions =
  | { method: 'graham'; asumsi: GrahamAssumptions }
  | { method: 'per_pbv'; asumsi: PerPbvAssumptions }
  | { method: 'dcf'; asumsi: DcfAssumptions }
  | { method: 'ddm'; asumsi: DdmAssumptions }

/** Benjamin Graham's formula: sqrt(22.5 * EPS * BVPS). Null if inputs can't yield a real number. */
export function grahamNumber({ eps, bvps }: GrahamAssumptions): number | null {
  const product = 22.5 * eps * bvps
  if (product <= 0) return null
  return Math.sqrt(product)
}

/** Fair value via a target PER or PBV multiple applied to EPS or BVPS. */
export function fairValuePerPbv(a: PerPbvAssumptions): number | null {
  if (a.basis === 'per') {
    if (a.eps === undefined) return null
    return a.eps * a.targetMultiple
  }
  if (a.bvps === undefined) return null
  return a.bvps * a.targetMultiple
}

/**
 * Simple DCF: discounts `years` of FCF growing at `growthRate`, plus a Gordon
 * growth terminal value beyond that, back to present value at `discountRate`.
 */
export function simpleDcf({ fcf, growthRate, discountRate, terminalGrowth, years = 5 }: DcfAssumptions): number | null {
  if (discountRate <= terminalGrowth) return null

  let pv = 0
  let projected = fcf
  for (let year = 1; year <= years; year++) {
    projected *= 1 + growthRate
    pv += projected / Math.pow(1 + discountRate, year)
  }

  const terminalValue = (projected * (1 + terminalGrowth)) / (discountRate - terminalGrowth)
  pv += terminalValue / Math.pow(1 + discountRate, years)

  return pv
}

/** Gordon growth single-stage dividend discount model: D1 / (r - g). */
export function ddm({ nextDividend, discountRate, growthRate }: DdmAssumptions): number | null {
  if (discountRate <= growthRate) return null
  return nextDividend / (discountRate - growthRate)
}

export function computeFairValue(input: ValuationAssumptions): number | null {
  switch (input.method) {
    case 'graham':
      return grahamNumber(input.asumsi)
    case 'per_pbv':
      return fairValuePerPbv(input.asumsi)
    case 'dcf':
      return simpleDcf(input.asumsi)
    case 'ddm':
      return ddm(input.asumsi)
  }
}

/** (fairValue - price) / fairValue — positive means undervalued (price below fair value). */
export function marginOfSafety(fairValue: number, currentPrice: number): number | null {
  if (fairValue <= 0) return null
  return (fairValue - currentPrice) / fairValue
}
