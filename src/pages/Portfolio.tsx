import { useState } from 'react'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { useWatchlistData } from '../hooks/useWatchlistData'
import { marketValue, portfolioWeights, unrealizedGain, unrealizedGainPct } from '../lib/portfolio'
import { marginOfSafety } from '../lib/valuation'
import type { Holding } from '../lib/types'

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtNum = (n: number) => Math.round(n).toLocaleString('id-ID')
const fmtPct = (n: number) => (n * 100).toFixed(1) + '%'

function HoldingsTable({
  holdings,
  prices,
  fairValues,
}: {
  holdings: Holding[]
  prices: Record<string, number>
  fairValues: Record<string, number>
}) {
  const held = holdings.filter((h) => h.lot > 0)
  const weights = portfolioWeights(held, prices)

  if (held.length === 0) {
    return <p className="text-slate-400 text-sm">Belum ada posisi terbuka.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-400 text-left">
          <tr>
            <th className="py-1 pr-3">Ticker</th>
            <th className="py-1 pr-3">Lot</th>
            <th className="py-1 pr-3">Avg Buy</th>
            <th className="py-1 pr-3">Harga Now</th>
            <th className="py-1 pr-3">Nilai Sekarang</th>
            <th className="py-1 pr-3">Unrealized P/L</th>
            <th className="py-1 pr-3">%</th>
            <th className="py-1 pr-3">Bobot</th>
            <th className="py-1">vs Nilai Wajar</th>
          </tr>
        </thead>
        <tbody>
          {held.map((h) => {
            const price = prices[h.ticker] ?? 0
            const gain = unrealizedGain(h, price)
            const gainPct = unrealizedGainPct(h, price)
            const weight = weights.get(h.ticker) ?? 0
            const value = marketValue(h, price)
            const fairValue = fairValues[h.ticker]
            const mos = fairValue && price ? marginOfSafety(fairValue, price) : null
            return (
              <tr key={`${h.security_id}-${h.ticker}`} className="border-t border-slate-800">
                <td className="py-1 pr-3 font-medium">{h.ticker}</td>
                <td className="py-1 pr-3">{h.lot}</td>
                <td className="py-1 pr-3">{fmtNum(h.avgBuyPrice)}</td>
                <td className="py-1 pr-3">{price ? fmtNum(price) : '-'}</td>
                <td className="py-1 pr-3">{price ? fmtNum(value) : '-'}</td>
                <td className={`py-1 pr-3 ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtNum(gain)}
                </td>
                <td className={`py-1 pr-3 ${gainPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(gainPct)}
                </td>
                <td className="py-1 pr-3">{fmtPct(weight)}</td>
                <td className={`py-1 ${mos === null ? 'text-slate-500' : mos >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {mos !== null ? (mos >= 0 ? '+' : '') + fmtPct(mos) : 'Belum ada'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Portfolio() {
  const {
    securities,
    holdingsBySecurity,
    holdingsGabungan,
    prices,
    cashBalance,
    cashBalanceBySecurity,
    loading,
    error,
    refresh,
  } = usePortfolioData()
  const { rows: watchlistRows } = useWatchlistData()
  const [tab, setTab] = useState<string>('gabungan')

  const fairValues: Record<string, number> = Object.fromEntries(
    watchlistRows.filter((r) => r.nilai_wajar !== null).map((r) => [r.ticker, r.nilai_wajar as number])
  )

  const holdingsForTab = tab === 'gabungan' ? holdingsGabungan : holdingsBySecurity.filter((h) => h.security_id === tab)
  const cashForTab = tab === 'gabungan' ? cashBalance : cashBalanceBySecurity[tab] ?? 0

  const stockValue = holdingsForTab
    .filter((h) => h.lot > 0)
    .reduce((sum, h) => sum + marketValue(h, prices[h.ticker] ?? 0), 0)
  const totalCost = holdingsForTab.filter((h) => h.lot > 0).reduce((sum, h) => sum + h.costBasis, 0)
  const totalGain = stockValue - totalCost
  const totalValue = stockValue + cashForTab

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Portofolio</h1>
        <button onClick={refresh} className="text-sm text-blue-400 hover:text-blue-300">
          Refresh harga
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-4">
        <p className="text-xs text-slate-400">Total Nilai Portofolio</p>
        <p className="text-2xl font-semibold">{fmtRp(totalValue)}</p>
        <p className={`text-sm mt-1 mb-3 ${totalGain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {totalGain >= 0 ? '+' : ''}
          {fmtRp(totalGain)} unrealized
        </p>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800">
          <div>
            <p className="text-xs text-slate-400">Nilai Saham</p>
            <p className="text-base font-medium">{fmtRp(stockValue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Kas</p>
            <p className={`text-base font-medium ${cashForTab < 0 ? 'text-red-400' : ''}`}>{fmtRp(cashForTab)}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button
          onClick={() => setTab('gabungan')}
          className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
            tab === 'gabungan' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
          }`}
        >
          Gabungan
        </button>
        {securities.map((s) => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
              tab === s.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {s.nama}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Memuat...</p>
      ) : (
        <HoldingsTable holdings={holdingsForTab} prices={prices} fairValues={fairValues} />
      )}
    </div>
  )
}
