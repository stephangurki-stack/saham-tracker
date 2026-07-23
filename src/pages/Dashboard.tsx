import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { useWatchlistData } from '../hooks/useWatchlistData'
import { computeCostBasisTimeline, marketValue } from '../lib/portfolio'
import { BUY_THRESHOLD_MOS } from '../lib/valuation'
import { CATEGORICAL, CHART_SURFACE, GRIDLINE, OTHER_SLICE, STATUS, TEXT_SECONDARY } from '../lib/chartColors'
import type { PortfolioSnapshot } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtRpCompact = (n: number) => {
  if (Math.abs(n) >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + 'jt'
  return fmtRp(n)
}
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'

export default function Dashboard() {
  const { user } = useAuth()
  const { holdingsGabungan, transactions, cashFlows, prices, quotes, cashBalance, loading, error } =
    usePortfolioData()
  const { withMos: watchlistWithMos } = useWatchlistData()

  const held = holdingsGabungan.filter((h) => h.lot > 0)
  const ownedTickers = new Set(held.map((h) => h.ticker))
  const buyCandidates = watchlistWithMos.filter(
    (w) => w.mos !== null && w.mos >= BUY_THRESHOLD_MOS && !ownedTickers.has(w.row.ticker)
  )
  const stockValue = held.reduce((sum, h) => sum + marketValue(h, prices[h.ticker] ?? 0), 0)
  const totalCost = held.reduce((sum, h) => sum + h.costBasis, 0)
  const totalGain = stockValue - totalCost
  const totalGainPct = totalCost > 0 ? totalGain / totalCost : 0
  const portfolioValue = stockValue + cashBalance

  const netDeposited = cashFlows.reduce(
    (sum, c) => sum + (c.tipe === 'deposit' ? c.jumlah : -c.jumlah),
    0
  )
  const growthSinceInception = netDeposited > 0 ? (portfolioValue - netDeposited) / netDeposited : null

  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
  const [lastYearInput, setLastYearInput] = useState('')
  const [savingLastYear, setSavingLastYear] = useState(false)
  const snapshotUpserted = useRef(false)

  async function loadSnapshots() {
    const { data } = await supabase.from('portfolio_snapshots').select('*')
    setSnapshots((data ?? []) as PortfolioSnapshot[])
  }

  useEffect(() => {
    loadSnapshots()
  }, [])

  // Record today's value once per Dashboard visit (upsert = 1 row/day), after
  // holdings/prices have finished loading so we don't snapshot a zero value.
  useEffect(() => {
    if (loading || !user || snapshotUpserted.current) return
    snapshotUpserted.current = true
    supabase
      .from('portfolio_snapshots')
      .upsert(
        {
          user_id: user.id,
          tanggal: todayISO(),
          nilai_saham: stockValue,
          nilai_kas: cashBalance,
          total: portfolioValue,
        },
        { onConflict: 'user_id,tanggal' }
      )
      .then(() => loadSnapshots())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, stockValue, cashBalance, portfolioValue])

  const currentYear = new Date().getFullYear()
  const lastYearSnapshot = snapshots
    .filter((s) => new Date(s.tanggal).getFullYear() === currentYear - 1)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0]

  // Matches the "Anual Report" sheet's Anual Progress formula: Profit/Loss ÷
  // (Awal Aset + Top Up), which excludes new deposits from the growth % so it
  // measures actual investment performance rather than capital added.
  const topUpThisYear = cashFlows
    .filter((c) => new Date(c.tanggal).getFullYear() === currentYear)
    .reduce((sum, c) => sum + (c.tipe === 'deposit' ? c.jumlah : -c.jumlah), 0)
  const awalAsetPlusTopUp = lastYearSnapshot ? lastYearSnapshot.total + topUpThisYear : 0
  const profitLossThisYear = lastYearSnapshot ? portfolioValue - lastYearSnapshot.total - topUpThisYear : 0
  const growthYoY =
    lastYearSnapshot && awalAsetPlusTopUp > 0 ? profitLossThisYear / awalAsetPlusTopUp : null

  async function handleSaveLastYear() {
    const value = Number(lastYearInput)
    if (!value || !user) return
    setSavingLastYear(true)
    await supabase.from('portfolio_snapshots').upsert(
      { user_id: user.id, tanggal: `${currentYear - 1}-12-31`, total: value },
      { onConflict: 'user_id,tanggal' }
    )
    setLastYearInput('')
    await loadSnapshots()
    setSavingLastYear(false)
  }

  const pieData = (() => {
    const withValue = held
      .map((h) => ({ ticker: h.ticker, value: marketValue(h, prices[h.ticker] ?? 0) }))
      .sort((a, b) => b.value - a.value)
    const top = withValue.slice(0, 8)
    const restValue = withValue.slice(8).reduce((sum, h) => sum + h.value, 0)
    return restValue > 0 ? [...top, { ticker: 'Lainnya', value: restValue }] : top
  })()

  const movers = held
    .map((h) => {
      const q = quotes[h.ticker]
      if (!q || !q.prevClose) return null
      return { ticker: h.ticker, changePct: (q.price - q.prevClose) / q.prevClose }
    })
    .filter((m): m is { ticker: string; changePct: number } => m !== null)
    .sort((a, b) => b.changePct - a.changePct)

  const gainers = movers.filter((m) => m.changePct > 0).slice(0, 3)
  const losers = movers
    .filter((m) => m.changePct < 0)
    .slice(-3)
    .reverse()

  const costBasisTimeline = computeCostBasisTimeline(transactions)

  if (loading) return <div className="p-4 text-slate-400 text-sm">Memuat...</div>

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {buyCandidates.length > 0 && (
        <Link
          to="/watchlist"
          className="block bg-emerald-950 border border-emerald-700 rounded-lg p-4 hover:border-emerald-500"
        >
          <p className="text-sm font-medium text-emerald-400 mb-1">
            {buyCandidates.length} saham watchlist mencapai margin of safety ≥ {(BUY_THRESHOLD_MOS * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-emerald-300">
            {buyCandidates.map((c) => `${c.row.ticker} (+${(c.mos! * 100).toFixed(1)}%)`).join(', ')}
          </p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Total Nilai Portofolio</p>
          <p className="text-xl font-semibold">{fmtRp(portfolioValue)}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Saham {fmtRpCompact(stockValue)} · Kas {fmtRpCompact(cashBalance)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Unrealized P/L</p>
          <p
            className="text-xl font-semibold"
            style={{ color: totalGain >= 0 ? STATUS.good : STATUS.critical }}
          >
            {fmtRp(totalGain)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: totalGain >= 0 ? STATUS.good : STATUS.critical }}>
            {fmtPct(totalGainPct)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Growth (sejak awal)</p>
          {growthSinceInception !== null ? (
            <>
              <p
                className="text-lg font-semibold"
                style={{ color: growthSinceInception >= 0 ? STATUS.good : STATUS.critical }}
              >
                {fmtPct(growthSinceInception)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Modal {fmtRpCompact(netDeposited)} → Kini {fmtRpCompact(portfolioValue)}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: portfolioValue - netDeposited >= 0 ? STATUS.good : STATUS.critical }}
              >
                Profit/Loss: {fmtRp(portfolioValue - netDeposited)}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500 mt-1">Belum ada setoran tercatat</p>
          )}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Annual Growth</p>
          {growthYoY !== null ? (
            <Link to="/growth" className="block hover:opacity-80">
              <p className="text-lg font-semibold" style={{ color: growthYoY >= 0 ? STATUS.good : STATUS.critical }}>
                {fmtPct(growthYoY)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Awal {fmtRpCompact(lastYearSnapshot!.total)} + Top Up {fmtRpCompact(topUpThisYear)} · P/L{' '}
                {fmtRpCompact(profitLossThisYear)}
              </p>
              <p className="text-xs text-blue-400 mt-1">Lihat riwayat →</p>
            </Link>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Isi nilai akhir {currentYear - 1}</p>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={lastYearInput}
                  onChange={(e) => setLastYearInput(e.target.value)}
                  placeholder="Rp"
                  className="w-full min-w-0 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-100"
                />
                <button
                  onClick={handleSaveLastYear}
                  disabled={savingLastYear}
                  className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-2 py-1 whitespace-nowrap"
                >
                  Simpan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(gainers.length > 0 || losers.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Top Gainers/Losers Hari Ini</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-2">Gainers</p>
              <ul className="space-y-1.5">
                {gainers.map((m) => (
                  <li key={m.ticker} className="flex justify-between text-sm">
                    <span>{m.ticker}</span>
                    <span style={{ color: STATUS.good }}>▲ {fmtPct(m.changePct)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2">Losers</p>
              <ul className="space-y-1.5">
                {losers.map((m) => (
                  <li key={m.ticker} className="flex justify-between text-sm">
                    <span>{m.ticker}</span>
                    <span style={{ color: STATUS.critical }}>▼ {fmtPct(m.changePct)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {pieData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Alokasi Portofolio</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="ticker" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell
                      key={entry.ticker}
                      fill={entry.ticker === 'Lainnya' ? OTHER_SLICE : CATEGORICAL[i % CATEGORICAL.length]}
                      stroke={CHART_SURFACE}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => fmtRp(Number(value ?? 0))}
                  contentStyle={{ background: CHART_SURFACE, border: `1px solid ${GRIDLINE}`, borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {pieData.map((entry, i) => (
              <div key={entry.ticker} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ background: entry.ticker === 'Lainnya' ? OTHER_SLICE : CATEGORICAL[i % CATEGORICAL.length] }}
                />
                {entry.ticker} ({fmtPct(stockValue > 0 ? entry.value / stockValue : 0).replace('+', '')})
              </div>
            ))}
          </div>
        </div>
      )}

      {costBasisTimeline.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-300 mb-1">Modal Diinvestasikan dari Waktu ke Waktu</p>
          <p className="text-xs text-slate-500 mb-3">
            Cost basis tertanam berdasarkan riwayat transaksi (bukan nilai pasar historis)
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costBasisTimeline} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="costBasisFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CATEGORICAL[0]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CATEGORICAL[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="tanggal"
                  tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
                  axisLine={{ stroke: GRIDLINE }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: TEXT_SECONDARY, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtRpCompact}
                  width={60}
                />
                <Tooltip
                  formatter={(value) => fmtRp(Number(value ?? 0))}
                  contentStyle={{ background: CHART_SURFACE, border: `1px solid ${GRIDLINE}`, borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area
                  type="stepAfter"
                  dataKey="totalCostBasis"
                  stroke={CATEGORICAL[0]}
                  strokeWidth={2}
                  fill="url(#costBasisFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {held.length === 0 && (
        <p className="text-slate-400 text-sm">
          Belum ada posisi. Catat transaksi pertama di halaman Transaksi.
        </p>
      )}
    </div>
  )
}
