import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { yahooFinanceProvider } from '../lib/priceProviders/yahooFinance'
import {
  computeFairValue,
  marginOfSafety,
  type DcfAssumptions,
  type DdmAssumptions,
  type GrahamAssumptions,
  type PerPbvAssumptions,
  type ValuationAssumptions,
  type ValuationMethod,
} from '../lib/valuation'
import type { WatchlistRow } from '../lib/types'

const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'

const methodLabels: Record<ValuationMethod, string> = {
  graham: 'Graham Number',
  per_pbv: 'PER / PBV Relatif',
  dcf: 'DCF Sederhana',
  ddm: 'Dividend Discount Model',
}

export default function Watchlist() {
  const { user } = useAuth()
  const [rows, setRows] = useState<WatchlistRow[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [ticker, setTicker] = useState('')
  const [method, setMethod] = useState<ValuationMethod>('graham')
  const [eps, setEps] = useState('')
  const [bvps, setBvps] = useState('')
  const [basis, setBasis] = useState<'per' | 'pbv'>('per')
  const [targetMultiple, setTargetMultiple] = useState('')
  const [fcf, setFcf] = useState('')
  const [growthRate, setGrowthRate] = useState('')
  const [discountRate, setDiscountRate] = useState('')
  const [terminalGrowth, setTerminalGrowth] = useState('')
  const [nextDividend, setNextDividend] = useState('')
  const [ddmGrowthRate, setDdmGrowthRate] = useState('')
  const [ddmDiscountRate, setDdmDiscountRate] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('tanggal_update', { ascending: false })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const watchlistRows = data as WatchlistRow[]
    setRows(watchlistRows)

    const tickers = watchlistRows.map((r) => r.ticker)
    if (tickers.length > 0) {
      try {
        const quotes = await yahooFinanceProvider.getPrices(tickers)
        setPrices(Object.fromEntries(Object.entries(quotes).map(([tk, q]) => [tk, q.price])))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mengambil harga')
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function buildAssumptions(): ValuationAssumptions | null {
    if (method === 'graham') {
      const a: GrahamAssumptions = { eps: Number(eps), bvps: Number(bvps) }
      return { method, asumsi: a }
    }
    if (method === 'per_pbv') {
      const a: PerPbvAssumptions = {
        basis,
        eps: basis === 'per' ? Number(eps) : undefined,
        bvps: basis === 'pbv' ? Number(bvps) : undefined,
        targetMultiple: Number(targetMultiple),
      }
      return { method, asumsi: a }
    }
    if (method === 'dcf') {
      const a: DcfAssumptions = {
        fcf: Number(fcf),
        growthRate: Number(growthRate),
        discountRate: Number(discountRate),
        terminalGrowth: Number(terminalGrowth),
      }
      return { method, asumsi: a }
    }
    const a: DdmAssumptions = {
      nextDividend: Number(nextDividend),
      discountRate: Number(ddmDiscountRate),
      growthRate: Number(ddmGrowthRate),
    }
    return { method, asumsi: a }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const tickerUpper = ticker.trim().toUpperCase()
    if (!tickerUpper) {
      setError('Isi ticker.')
      return
    }
    if (!user) return

    const assumptions = buildAssumptions()
    if (!assumptions) return
    const fairValue = computeFairValue(assumptions)
    if (fairValue === null) {
      setError('Input tidak valid untuk menghasilkan nilai wajar (cek angka yang dimasukkan).')
      return
    }

    setSubmitting(true)

    const { error: stockErr } = await supabase
      .from('stocks')
      .upsert({ ticker: tickerUpper }, { onConflict: 'ticker', ignoreDuplicates: true })
    if (stockErr) {
      setError(stockErr.message)
      setSubmitting(false)
      return
    }

    const { error: wlErr } = await supabase.from('watchlist').upsert(
      {
        user_id: user.id,
        ticker: tickerUpper,
        metode_valuasi: method,
        asumsi: assumptions.asumsi,
        nilai_wajar: fairValue,
        tanggal_update: new Date().toISOString(),
      },
      { onConflict: 'user_id,ticker' }
    )

    if (wlErr) setError(wlErr.message)
    else {
      setTicker('')
      load()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus dari watchlist?')) return
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Watchlist &amp; Nilai Wajar</h1>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="BBCA"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100 uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Metode Valuasi</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ValuationMethod)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
            >
              {(Object.keys(methodLabels) as ValuationMethod[]).map((m) => (
                <option key={m} value={m}>
                  {methodLabels[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {method === 'graham' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">EPS (Rp)</label>
              <input type="number" value={eps} onChange={(e) => setEps(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">BVPS (Rp)</label>
              <input type="number" value={bvps} onChange={(e) => setBvps(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
          </div>
        )}

        {method === 'per_pbv' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Basis</label>
              <select value={basis} onChange={(e) => setBasis(e.target.value as 'per' | 'pbv')} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100">
                <option value="per">PER (pakai EPS)</option>
                <option value="pbv">PBV (pakai BVPS)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Multiple</label>
              <input type="number" value={targetMultiple} onChange={(e) => setTargetMultiple(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            {basis === 'per' ? (
              <div>
                <label className="block text-xs text-slate-400 mb-1">EPS (Rp)</label>
                <input type="number" value={eps} onChange={(e) => setEps(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-400 mb-1">BVPS (Rp)</label>
                <input type="number" value={bvps} onChange={(e) => setBvps(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
              </div>
            )}
          </div>
        )}

        {method === 'dcf' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">FCF per Lembar (Rp)</label>
              <input type="number" value={fcf} onChange={(e) => setFcf(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Growth Rate (mis. 0.1)</label>
              <input type="number" step="0.01" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Discount Rate (mis. 0.12)</label>
              <input type="number" step="0.01" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Terminal Growth (mis. 0.03)</label>
              <input type="number" step="0.01" value={terminalGrowth} onChange={(e) => setTerminalGrowth(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
          </div>
        )}

        {method === 'ddm' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Dividen Tahun Depan (Rp)</label>
              <input type="number" value={nextDividend} onChange={(e) => setNextDividend(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Discount Rate (mis. 0.1)</label>
              <input type="number" step="0.01" value={ddmDiscountRate} onChange={(e) => setDdmDiscountRate(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Growth Rate (mis. 0.04)</label>
              <input type="number" step="0.01" value={ddmGrowthRate} onChange={(e) => setDdmGrowthRate(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2"
        >
          Simpan ke Watchlist
        </button>
      </form>

      <h2 className="text-sm font-medium text-slate-300 mb-2">Daftar Pantauan</h2>
      {loading ? (
        <p className="text-slate-400 text-sm">Memuat...</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 text-sm">Belum ada saham di watchlist.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const price = prices[r.ticker]
            const mos = r.nilai_wajar && price ? marginOfSafety(r.nilai_wajar, price) : null
            const undervalued = mos !== null && mos >= 0
            return (
              <div
                key={r.id}
                className={`bg-slate-900 border rounded-lg p-4 ${
                  mos === null ? 'border-slate-800' : undervalued ? 'border-emerald-700' : 'border-red-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{r.ticker}</span>
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:text-red-300">
                    Hapus
                  </button>
                </div>
                <p className="text-xs text-slate-500 mb-2">{methodLabels[r.metode_valuasi]}</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Nilai Wajar</p>
                    <p>{r.nilai_wajar ? fmtRp(r.nilai_wajar) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Harga Sekarang</p>
                    <p>{price ? fmtRp(price) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Margin of Safety</p>
                    <p className={undervalued ? 'text-emerald-400' : 'text-red-400'}>
                      {mos !== null ? fmtPct(mos) : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
