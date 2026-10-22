import { describe, expect, it } from 'vitest'
import { buyRatioLimit, evaluateBuy, evaluateSell, expectedReturn3y, type BuyInput, type SellInput } from './policy'

const NOW = new Date('2026-10-22')

function sell(o: Partial<SellInput> = {}): SellInput {
  return {
    jenis: 'V',
    isBank: false,
    isMsci: false,
    price: 800,
    fairValue: 1000,
    fairValue3y: 1200,
    dividendYieldPct: 2,
    weight: 0.08,
    firstBuyDate: '2025-10-01',
    lastCheckPrice: null,
    tandaBahaya: false,
    tesisPatah: false,
    penggantiLebihBaik: false,
    lamp: 'hijau',
    now: NOW,
    ...o,
  }
}

function buy(o: Partial<BuyInput> = {}): BuyInput {
  return {
    jenis: 'V',
    isBank: false,
    isMsci: false,
    hasThesis: true,
    ringkasan: 'Distribusi farmasi',
    price: 650,
    fairValue: 1000,
    fairValue3y: 1200,
    dividendYieldPct: 3,
    saringanLolos: true,
    fscore: 7,
    roeOk: null,
    checklistLengkap: true,
    lamp: 'hijau',
    ...o,
  }
}

describe('expectedReturn3y', () => {
  it('matches the worked example in the policy (1400 -> 2000, 2% dividend ≈ 14.6%)', () => {
    expect(expectedReturn3y(1400, 2000, 2)).toBeCloseTo(0.146, 2)
  })
  it('is null without a 3-year fair value', () => {
    expect(expectedReturn3y(1000, null, 2)).toBeNull()
  })
})

describe('buyRatioLimit', () => {
  it('follows the lamp table', () => {
    expect(buyRatioLimit('Q', false, 'hijau')).toBe(0.7)
    expect(buyRatioLimit('V', false, 'kuning')).toBe(0.65)
    expect(buyRatioLimit('V', true, 'hijau')).toBe(0.65)
    expect(buyRatioLimit('V', true, 'merah')).toBe(0.6)
    expect(buyRatioLimit('S', false, 'hijau')).toBe(0.6)
    expect(buyRatioLimit('S', false, 'merah')).toBeNull()
  })
})

describe('evaluateSell', () => {
  it('sells everything immediately on a serious red flag', () => {
    expect(evaluateSell(sell({ tandaBahaya: true })).decision).toBe('JUAL SEMUA SEGERA')
  })

  it('sells when the thesis is broken, even if cheap', () => {
    expect(evaluateSell(sell({ tesisPatah: true })).decision).toBe('JUAL')
  })

  it('red flag takes priority over broken thesis', () => {
    expect(evaluateSell(sell({ tandaBahaya: true, tesisPatah: true })).decision).toBe('JUAL SEMUA SEGERA')
  })

  it('V: ratio 1.00–1.10 sells half, >1.10 sells all', () => {
    expect(evaluateSell(sell({ price: 1050 })).decision).toBe('JUAL SEBAGIAN')
    expect(evaluateSell(sell({ price: 1200 })).decision).toBe('JUAL')
  })

  it('Q: ratio >1.25 sells a third; sells all only if expected return is also <10%', () => {
    expect(evaluateSell(sell({ jenis: 'Q', price: 1300, fairValue3y: 2000 })).decision).toBe('JUAL SEBAGIAN')
    expect(evaluateSell(sell({ jenis: 'Q', price: 1300, fairValue3y: 1300, dividendYieldPct: 0 })).decision).toBe('JUAL')
  })

  it('S: ratio >1.00 sells all', () => {
    expect(evaluateSell(sell({ jenis: 'S', price: 1010 })).decision).toBe('JUAL')
  })

  it('reduces an oversized position that is no longer deeply discounted', () => {
    const r = evaluateSell(sell({ weight: 0.25, price: 900 }))
    expect(r.decision).toBe('KURANGI')
  })

  it('does not reduce a big position that is still deeply discounted', () => {
    expect(evaluateSell(sell({ weight: 0.25, price: 600 })).decision).not.toBe('KURANGI')
  })

  it('starts selling when expected 3y return is below 10%', () => {
    expect(evaluateSell(sell({ price: 900, fairValue3y: 900, dividendYieldPct: 0 })).decision).toBe('JUAL SEBAGIAN')
  })

  it('flags V held past 3 years for evaluation', () => {
    expect(evaluateSell(sell({ firstBuyDate: '2022-01-01' })).decision).toBe('EVALUASI')
    expect(evaluateSell(sell({ jenis: 'Q', firstBuyDate: '2020-01-01' })).decision).not.toBe('EVALUASI')
  })

  it('swaps when a clearly better replacement is flagged', () => {
    expect(evaluateSell(sell({ penggantiLebihBaik: true })).decision).toBe('TUKAR')
  })

  it('adds in the buy zone with good return and room in the weight cap', () => {
    const r = evaluateSell(sell({ price: 500 }))
    expect(r.decision).toBe('TAMBAH')
  })

  it('never adds S positions, and does not add past the weight cap', () => {
    expect(evaluateSell(sell({ jenis: 'S', price: 400 })).decision).toBe('TAHAN')
    expect(evaluateSell(sell({ price: 500, weight: 0.13 })).decision).toBe('TAHAN')
  })

  it('holds in the middle of the hold zone', () => {
    expect(evaluateSell(sell({ price: 850 })).decision).toBe('TAHAN')
  })

  it('asks for data when there is no fair value', () => {
    expect(evaluateSell(sell({ fairValue: null })).decision).toBe('DATA KURANG')
  })

  it('raises an alert (without stopping) on a ≥20% drop since last check', () => {
    const r = evaluateSell(sell({ lastCheckPrice: 1100, price: 850 }))
    expect(r.alerts.length).toBe(1)
    expect(r.decision).toBe('TAHAN')
  })

  it('tightens the add threshold in a yellow lamp', () => {
    expect(evaluateSell(sell({ price: 680, lamp: 'hijau' })).decision).toBe('TAMBAH')
    expect(evaluateSell(sell({ price: 680, lamp: 'kuning' })).decision).toBe('TAHAN')
    expect(evaluateSell(sell({ price: 650, lamp: 'kuning' })).decision).toBe('TAMBAH')
    expect(evaluateSell(sell({ price: 660, lamp: 'kuning' })).decision).toBe('TAHAN')
  })
})

describe('evaluateBuy', () => {
  it('buys tranche 1 when everything passes', () => {
    const r = evaluateBuy(buy())
    expect(r.decision).toBe('BELI TAHAP 1')
    expect(r.tranchePct).toBeCloseTo(0.04)
  })

  it('asks for data when screening has not been done', () => {
    expect(evaluateBuy(buy({ saringanLolos: null })).decision).toBe('DATA KURANG')
    expect(evaluateBuy(buy({ hasThesis: false })).decision).toBe('DATA KURANG')
    expect(evaluateBuy(buy({ fairValue: null })).decision).toBe('DATA KURANG')
  })

  it('skips stocks that fail screening or have a poor F-score', () => {
    expect(evaluateBuy(buy({ saringanLolos: false })).decision).toBe('LEWATI')
    expect(evaluateBuy(buy({ fscore: 4 })).decision).toBe('LEWATI')
    expect(evaluateBuy(buy({ fscore: 6 })).decision).toBe('BELI TAHAP 1')
  })

  it('Q requires ROE ≥15%', () => {
    expect(evaluateBuy(buy({ jenis: 'Q', roeOk: false })).decision).toBe('LEWATI')
    expect(evaluateBuy(buy({ jenis: 'Q', roeOk: true })).decision).toBe('BELI TAHAP 1')
  })

  it('puts it on the shopping list with a max price when above the buy limit', () => {
    const r = evaluateBuy(buy({ price: 800 }))
    expect(r.decision).toBe('DAFTAR BELANJA')
    expect(r.maxPrice).toBe(700)
  })

  it('shopping list when expected return is under 15% even if cheap', () => {
    expect(evaluateBuy(buy({ price: 650, fairValue3y: 700, dividendYieldPct: 0 })).decision).toBe('DAFTAR BELANJA')
  })

  it('asks to complete the checklist before buying', () => {
    expect(evaluateBuy(buy({ checklistLengkap: false })).decision).toBe('LENGKAPI CHECKLIST')
  })

  it('does not buy S in a red lamp, and lowers the max price in yellow', () => {
    expect(evaluateBuy(buy({ jenis: 'S', lamp: 'merah' })).decision).toBe('TIDAK MEMBELI')
    expect(evaluateBuy(buy({ lamp: 'kuning' })).maxPrice).toBe(650)
  })

  it('uses the stricter 0.65 limit for banks / MSCI stocks', () => {
    expect(evaluateBuy(buy({ isBank: true, price: 680 })).decision).toBe('DAFTAR BELANJA')
    expect(evaluateBuy(buy({ isBank: true, price: 640 })).decision).toBe('BELI TAHAP 1')
  })
})
