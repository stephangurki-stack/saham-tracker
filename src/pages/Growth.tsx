import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { marketValue } from '../lib/portfolio'
import { STATUS } from '../lib/chartColors'
import type { PortfolioSnapshot } from '../lib/types'

const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%'

interface YearlyGrowth {
  year: number
  awalAset: number
  topUp: number
  totalAset: number
  profitLoss: number
  growthPct: number | null
  fixed?: boolean
}

/**
 * Years before cash_flows tracked deposits in isolation per-year (early
 * migrated data lumps multi-year capital into a single dated entry), so Top
 * Up/Profit-Loss can't be recomputed reliably from the database. These are
 * taken verbatim from the "Anual Report" sheet instead of derived.
 */
const HISTORICAL_GROWTH: YearlyGrowth[] = [
  {
    year: 2025,
    awalAset: 98_000_000,
    topUp: 23_750_000,
    totalAset: 172_092_551,
    profitLoss: 50_342_551,
    growthPct: 50_342_551 / (98_000_000 + 23_750_000),
    fixed: true,
  },
]

export default function Growth() {
  const { holdingsGabungan, cashFlows, prices, cashBalance, loading } = usePortfolioData()
  const { hidden } = usePrivacyMode()
  const fmtRp = (n: number) => (hidden ? 'Rp ••••••' : 'Rp ' + Math.round(n).toLocaleString('id-ID'))
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)

  useEffect(() => {
    supabase
      .from('portfolio_snapshots')
      .select('*')
      .then(({ data }) => {
        setSnapshots((data ?? []) as PortfolioSnapshot[])
        setLoadingSnapshots(false)
      })
  }, [])

  if (loading || loadingSnapshots) return <div className="p-4 text-slate-600 text-sm">Memuat...</div>

  const stockValue = holdingsGabungan
    .filter((h) => h.lot > 0)
    .reduce((sum, h) => sum + marketValue(h, prices[h.ticker] ?? 0), 0)
  const currentPortfolioValue = stockValue + cashBalance
  const currentYear = new Date().getFullYear()

  function yearEndValue(year: number): number | null {
    const inYear = snapshots
      .filter((s) => new Date(s.tanggal).getFullYear() === year)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    return inYear[0]?.total ?? null
  }

  const years = new Set<number>([currentYear])
  snapshots.forEach((s) => years.add(new Date(s.tanggal).getFullYear()))
  cashFlows.forEach((c) => years.add(new Date(c.tanggal).getFullYear()))

  const rows: YearlyGrowth[] = []
  for (const year of Array.from(years).sort((a, b) => a - b)) {
    const awalAset = yearEndValue(year - 1)
    if (awalAset === null) continue
    const totalAset = year === currentYear ? currentPortfolioValue : yearEndValue(year)
    if (totalAset === null) continue
    const topUp = cashFlows
      .filter((c) => new Date(c.tanggal).getFullYear() === year)
      .reduce((sum, c) => sum + (c.tipe === 'deposit' ? c.jumlah : -c.jumlah), 0)
    const profitLoss = totalAset - awalAset - topUp
    const denom = awalAset + topUp
    rows.push({ year, awalAset, topUp, totalAset, profitLoss, growthPct: denom > 0 ? profitLoss / denom : null })
  }
  const dynamicYears = new Set(rows.map((r) => r.year))
  for (const historical of HISTORICAL_GROWTH) {
    if (!dynamicYears.has(historical.year)) rows.push(historical)
  }
  rows.sort((a, b) => b.year - a.year)

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link to="/" className="text-sm text-slate-600 hover:text-slate-800">
        ← Dashboard
      </Link>
      <div>
        <h1 className="text-lg font-semibold">Riwayat Annual Growth</h1>
        <p className="text-xs text-slate-400 mt-1">
          Growth% = Profit/Loss ÷ (Awal Aset + Top Up) — setoran modal baru tidak ikut dihitung sebagai performa
          investasi
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-slate-600 text-sm">
          Belum ada data cukup untuk menghitung growth tahunan. Perlu nilai akhir tahun sebelumnya (isi manual di
          Dashboard, atau tunggu snapshot otomatis terkumpul di akhir tahun).
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.year} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-700">
                  {r.year - 1} → {r.year}
                  {r.fixed && <span className="text-xs text-slate-400 font-normal ml-2">dari Anual Report</span>}
                </p>
                {r.growthPct !== null ? (
                  <p
                    className="text-lg font-semibold"
                    style={{ color: r.growthPct >= 0 ? STATUS.good : STATUS.critical }}
                  >
                    {fmtPct(r.growthPct)}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">-</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>Awal Aset: {fmtRp(r.awalAset)}</span>
                <span>Top Up: {fmtRp(r.topUp)}</span>
                <span>Total Aset: {fmtRp(r.totalAset)}</span>
                <span>Profit/Loss: {fmtRp(r.profitLoss)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
