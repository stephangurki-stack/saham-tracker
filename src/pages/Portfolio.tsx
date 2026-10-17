import { useState } from 'react'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { useWatchlistData } from '../hooks/useWatchlistData'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { marketValue, portfolioWeights, unrealizedGain, unrealizedGainPct } from '../lib/portfolio'
import { marginOfSafety } from '../lib/valuation'
import type { Holding } from '../lib/types'

const fmtPctDec = (n: number) => (n * 100).toFixed(1).replace('.', ',') + '%'

function HoldingsTable({
  holdings,
  prices,
  fairValues,
  dividendByTicker,
}: {
  holdings: Holding[]
  prices: Record<string, number>
  fairValues: Record<string, number>
  dividendByTicker: Record<string, number>
}) {
  const { hidden } = usePrivacyMode()
  const fmtNum = (n: number) => (hidden ? '••••' : Math.round(n).toLocaleString('id-ID'))
  const fmtCompact = (n: number) => {
    if (hidden) return '••••'
    const abs = Math.abs(n)
    if (abs >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + 'M'
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + 'jt'
    return Math.round(n).toLocaleString('id-ID')
  }
  const fmtSigned = (n: number) => (n > 0 ? '+' : '') + fmtCompact(n)
  const held = holdings.filter((h) => h.lot > 0).sort((a, b) => a.ticker.localeCompare(b.ticker))
  const weights = portfolioWeights(held, prices)

  if (held.length === 0) {
    return <p className="text-slate-600 text-sm">Belum ada posisi terbuka.</p>
  }

  const sub = 'block text-xs text-slate-400'
  const th = 'py-2 px-1.5 font-normal text-xs text-slate-500 text-right'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '14%' }} />
        </colgroup>
        <thead className="border-b border-slate-300">
          <tr>
            <th className={`${th} !text-left`}>No</th>
            <th className={`${th} !text-left`}>Saham</th>
            <th className={th}>Harga</th>
            <th className={th}>Market Value</th>
            <th className={th}>P/L</th>
            <th className={th}>Nilai Wajar</th>
            <th className={th}>Dividen</th>
          </tr>
        </thead>
        <tbody>
          {held.map((h, i) => {
            const price = prices[h.ticker] ?? 0
            const gain = unrealizedGain(h, price)
            const gainPct = unrealizedGainPct(h, price)
            const weight = weights.get(h.ticker) ?? 0
            const value = marketValue(h, price)
            const fairValue = fairValues[h.ticker]
            const mos = fairValue && price ? marginOfSafety(fairValue, price) : null
            const gainColor = gain >= 0 ? 'text-emerald-600' : 'text-red-600'
            const dividend = dividendByTicker[h.ticker]
            return (
              <tr key={`${h.security_id}-${h.ticker}`} className="border-t border-slate-200 align-top">
                <td className="py-2 pl-0 pr-1 text-left text-slate-400">{i + 1}</td>
                <td className="py-2 px-1.5 text-left">
                  <span className="font-medium">{h.ticker}</span>
                  <span className={sub}>
                    {h.firstBuyDate ? new Date(h.firstBuyDate).getFullYear() : '-'} · {h.lot} lot
                  </span>
                </td>
                <td className="py-2 px-1.5 text-right">
                  {price ? fmtNum(price) : '-'}
                  <span className={sub}>Avg {fmtNum(h.avgBuyPrice)}</span>
                </td>
                <td className="py-2 px-1.5 text-right">
                  {price ? fmtCompact(value) : '-'}
                  <span className={sub}>Modal {fmtCompact(h.costBasis)}</span>
                </td>
                <td className={`py-2 px-1.5 text-right ${gainColor}`}>
                  {fmtSigned(gain)}
                  <span className="block text-xs">{(gainPct > 0 ? '+' : '') + fmtPctDec(gainPct)}</span>
                </td>
                <td className="py-2 px-1.5 text-right">
                  {fairValue ? fmtNum(fairValue) : <span className="text-slate-400">-</span>}
                  {mos !== null && (
                    <span
                      className={`mt-0.5 ml-auto block w-fit rounded px-1.5 text-xs ${
                        mos >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {(mos >= 0 ? '+' : '') + fmtPctDec(mos)}
                    </span>
                  )}
                </td>
                <td className="py-2 px-1.5 text-right">
                  {dividend ? fmtCompact(dividend) : '-'}
                  <span className={sub}>Bobot {fmtPctDec(weight)}</span>
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
    dividends,
    loading,
    error,
    refresh,
  } = usePortfolioData()
  const { rows: watchlistRows } = useWatchlistData()
  const { hidden } = usePrivacyMode()
  const fmtNum = (n: number) => (hidden ? '••••••' : Math.round(n).toLocaleString('id-ID'))
  const [tab, setTab] = useState<string>('gabungan')

  const fairValues: Record<string, number> = Object.fromEntries(
    watchlistRows.filter((r) => r.nilai_wajar !== null).map((r) => [r.ticker, r.nilai_wajar as number])
  )

  const dividendByTicker: Record<string, number> = {}
  for (const d of dividends) {
    if (tab === 'gabungan' || d.security_id === tab) {
      dividendByTicker[d.ticker] = (dividendByTicker[d.ticker] ?? 0) + d.total
    }
  }

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
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Portofolio</h1>
        <button onClick={refresh} className="text-sm text-blue-600 hover:text-blue-700">
          Refresh harga
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Semua nilai dalam Rupiah (Rp)</p>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
        <p className="text-xs text-slate-600">Total Nilai Portofolio</p>
        <p className="text-2xl font-semibold">{fmtNum(totalValue)}</p>
        <p className={`text-sm mt-1 mb-3 ${totalGain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {totalGain >= 0 ? '+' : ''}
          {fmtNum(totalGain)} unrealized
        </p>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
          <div>
            <p className="text-xs text-slate-600">Nilai Saham</p>
            <p className="text-base font-medium">{fmtNum(stockValue)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Kas</p>
            <p className={`text-base font-medium ${cashForTab < 0 ? 'text-red-600' : ''}`}>{fmtNum(cashForTab)}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button
          onClick={() => setTab('gabungan')}
          className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
            tab === 'gabungan' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Gabungan
        </button>
        {securities.map((s) => (
          <button
            key={s.id}
            onClick={() => setTab(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
              tab === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {s.nama}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-600 text-sm">Memuat...</p>
      ) : (
        <HoldingsTable
          holdings={holdingsForTab}
          prices={prices}
          fairValues={fairValues}
          dividendByTicker={dividendByTicker}
        />
      )}
    </div>
  )
}
