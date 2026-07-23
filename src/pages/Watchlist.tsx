import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { useWatchlistData } from '../hooks/useWatchlistData'
import {
  BUY_THRESHOLD_MOS,
  computeFairValue,
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

// Sensible starting points for IDX blue-chip-ish assumptions — user edits from here
// rather than typing from a blank field every time.
const DCF_DEFAULTS = { growthRate: '0.08', discountRate: '0.1', terminalGrowth: '0.03' }
const DDM_DEFAULTS = { growthRate: '0.05', discountRate: '0.1' }

export default function Watchlist() {
  const { user } = useAuth()
  const { withMos, loading, error: loadError, refresh } = useWatchlistData()
  const { holdingsGabungan } = usePortfolioData()
  const ownedTickers = new Set(holdingsGabungan.filter((h) => h.lot > 0).map((h) => h.ticker))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fetchingFundamentals, setFetchingFundamentals] = useState(false)
  const [fundamentalsNote, setFundamentalsNote] = useState<string | null>(null)

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

  async function handleFetchFundamentals() {
    const tickerUpper = ticker.trim().toUpperCase()
    if (!tickerUpper) {
      setFundamentalsNote('Isi ticker dulu.')
      return
    }
    setFetchingFundamentals(true)
    setFundamentalsNote(null)
    try {
      const res = await fetch(`/api/fundamentals?ticker=${encodeURIComponent(tickerUpper)}`)
      if (!res.ok) throw new Error('unavailable')
      const data = await res.json()
      if (data.eps !== null) setEps(String(data.eps))
      if (data.bvps !== null) setBvps(String(data.bvps))
      setFundamentalsNote(
        data.eps !== null || data.bvps !== null
          ? 'Terisi dari Yahoo Finance — cek ulang sebelum simpan.'
          : 'Data tidak tersedia, isi manual.'
      )
    } catch {
      setFundamentalsNote('Tidak bisa mengambil data otomatis, isi manual.')
    }
    setFetchingFundamentals(false)
  }

  function handleMethodChange(m: ValuationMethod) {
    setMethod(m)
    if (m === 'dcf') {
      if (!growthRate) setGrowthRate(DCF_DEFAULTS.growthRate)
      if (!discountRate) setDiscountRate(DCF_DEFAULTS.discountRate)
      if (!terminalGrowth) setTerminalGrowth(DCF_DEFAULTS.terminalGrowth)
    } else if (m === 'ddm') {
      if (!ddmGrowthRate) setDdmGrowthRate(DDM_DEFAULTS.growthRate)
      if (!ddmDiscountRate) setDdmDiscountRate(DDM_DEFAULTS.discountRate)
    }
  }

  function resetForm() {
    setEditingId(null)
    setTicker('')
    setMethod('graham')
    setEps('')
    setBvps('')
    setBasis('per')
    setTargetMultiple('')
    setFcf('')
    setGrowthRate('')
    setDiscountRate('')
    setTerminalGrowth('')
    setNextDividend('')
    setDdmGrowthRate('')
    setDdmDiscountRate('')
  }

  function startEdit(row: WatchlistRow) {
    setError(null)
    setEditingId(row.id)
    setTicker(row.ticker)
    setMethod(row.metode_valuasi)
    const a = row.asumsi as Record<string, number | string>

    if (row.metode_valuasi === 'graham') {
      setEps(String(a.eps ?? ''))
      setBvps(String(a.bvps ?? ''))
    } else if (row.metode_valuasi === 'per_pbv') {
      setBasis((a.basis as 'per' | 'pbv') ?? 'per')
      setEps(a.eps !== undefined ? String(a.eps) : '')
      setBvps(a.bvps !== undefined ? String(a.bvps) : '')
      setTargetMultiple(String(a.targetMultiple ?? ''))
    } else if (row.metode_valuasi === 'dcf') {
      setFcf(String(a.fcf ?? ''))
      setGrowthRate(String(a.growthRate ?? ''))
      setDiscountRate(String(a.discountRate ?? ''))
      setTerminalGrowth(String(a.terminalGrowth ?? ''))
    } else {
      setNextDividend(String(a.nextDividend ?? ''))
      setDdmDiscountRate(String(a.discountRate ?? ''))
      setDdmGrowthRate(String(a.growthRate ?? ''))
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  function hasRequiredInputs(): boolean {
    if (method === 'graham') return !!eps && !!bvps
    if (method === 'per_pbv') return !!targetMultiple && (basis === 'per' ? !!eps : !!bvps)
    if (method === 'dcf') return !!fcf && !!growthRate && !!discountRate && !!terminalGrowth
    return !!nextDividend && !!ddmDiscountRate && !!ddmGrowthRate
  }

  const livePreview = hasRequiredInputs() ? computeFairValue(buildAssumptions()!) : null

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
      resetForm()
      refresh()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus dari watchlist?')) return
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (error) setError(error.message)
    else refresh()
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Watchlist &amp; Nilai Wajar</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 mb-6 space-y-3">
        {editingId && (
          <p className="text-xs text-blue-600">
            Mengedit asumsi untuk {ticker}.{' '}
            <button type="button" onClick={resetForm} className="underline hover:text-blue-700">
              Batal
            </button>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="BBCA"
              disabled={!!editingId}
              className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900 uppercase disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Metode Valuasi</label>
            <select
              value={method}
              onChange={(e) => handleMethodChange(e.target.value as ValuationMethod)}
              className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
            >
              {(Object.keys(methodLabels) as ValuationMethod[]).map((m) => (
                <option key={m} value={m}>
                  {methodLabels[m]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(method === 'graham' || method === 'per_pbv') && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchFundamentals}
              disabled={fetchingFundamentals}
              className="text-xs rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 px-2.5 py-1.5 border border-slate-300"
            >
              {fetchingFundamentals ? 'Mengambil...' : 'Ambil EPS/BVPS dari Yahoo Finance'}
            </button>
            {fundamentalsNote && <span className="text-xs text-slate-400">{fundamentalsNote}</span>}
          </div>
        )}

        {method === 'graham' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">EPS (Rp)</label>
              <input type="number" value={eps} onChange={(e) => setEps(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">BVPS (Rp)</label>
              <input type="number" value={bvps} onChange={(e) => setBvps(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
          </div>
        )}

        {method === 'per_pbv' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Basis</label>
              <select value={basis} onChange={(e) => setBasis(e.target.value as 'per' | 'pbv')} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900">
                <option value="per">PER (pakai EPS)</option>
                <option value="pbv">PBV (pakai BVPS)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Target Multiple</label>
              <input type="number" value={targetMultiple} onChange={(e) => setTargetMultiple(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            {basis === 'per' ? (
              <div>
                <label className="block text-xs text-slate-600 mb-1">EPS (Rp)</label>
                <input type="number" value={eps} onChange={(e) => setEps(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-slate-600 mb-1">BVPS (Rp)</label>
                <input type="number" value={bvps} onChange={(e) => setBvps(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
              </div>
            )}
          </div>
        )}

        {method === 'dcf' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">FCF per Lembar (Rp)</label>
              <input type="number" value={fcf} onChange={(e) => setFcf(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Growth Rate (mis. 0.1)</label>
              <input type="number" step="0.01" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Discount Rate (mis. 0.12)</label>
              <input type="number" step="0.01" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Terminal Growth (mis. 0.03)</label>
              <input type="number" step="0.01" value={terminalGrowth} onChange={(e) => setTerminalGrowth(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
          </div>
        )}

        {method === 'ddm' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Dividen Tahun Depan (Rp)</label>
              <input type="number" value={nextDividend} onChange={(e) => setNextDividend(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Discount Rate (mis. 0.1)</label>
              <input type="number" step="0.01" value={ddmDiscountRate} onChange={(e) => setDdmDiscountRate(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Growth Rate (mis. 0.04)</label>
              <input type="number" step="0.01" value={ddmGrowthRate} onChange={(e) => setDdmGrowthRate(e.target.value)} className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </div>
          </div>
        )}

        <div className="bg-slate-100/60 border border-slate-300 rounded-md px-3 py-2">
          <p className="text-xs text-slate-600">Nilai Wajar (preview)</p>
          <p className="text-lg font-semibold">
            {livePreview !== null ? fmtRp(livePreview) : hasRequiredInputs() ? 'Input tidak valid' : '-'}
          </p>
        </div>

        {(error || loadError) && <p className="text-sm text-red-600">{error ?? loadError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2"
        >
          {editingId ? 'Update Watchlist' : 'Simpan ke Watchlist'}
        </button>
      </form>

      <h2 className="text-sm font-medium text-slate-700 mb-2">Daftar Pantauan</h2>
      {loading ? (
        <p className="text-slate-600 text-sm">Memuat...</p>
      ) : withMos.length === 0 ? (
        <p className="text-slate-600 text-sm">Belum ada saham di watchlist.</p>
      ) : (
        <div className="space-y-2">
          {withMos.map(({ row, price, mos }) => {
            const undervalued = mos !== null && mos >= 0
            const isBuy = mos !== null && mos >= BUY_THRESHOLD_MOS
            return (
              <div
                key={row.id}
                className={`bg-white border rounded-lg p-4 ${
                  mos === null ? 'border-slate-200' : undervalued ? 'border-emerald-300' : 'border-red-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.ticker}</span>
                    {isBuy && (
                      <span className="text-xs font-semibold bg-emerald-600 text-white px-2 py-0.5 rounded">
                        BELI
                      </span>
                    )}
                    {ownedTickers.has(row.ticker) && (
                      <span className="text-xs font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        Di Portofolio
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => startEdit(row)} className="text-blue-600 hover:text-blue-700">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(row.id)} className="text-red-600 hover:text-red-700">
                      Hapus
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-2">{methodLabels[row.metode_valuasi]}</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-600">Nilai Wajar</p>
                    <p>{row.nilai_wajar ? fmtRp(row.nilai_wajar) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Harga Sekarang</p>
                    <p>{price ? fmtRp(price) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Margin of Safety</p>
                    <p className={undervalued ? 'text-emerald-600' : 'text-red-600'}>
                      {mos !== null ? fmtPct(mos) : '-'}
                    </p>
                  </div>
                </div>
                {isBuy && (
                  <p className="text-xs text-emerald-600 mt-2">
                    Margin of safety ≥ {fmtPct(BUY_THRESHOLD_MOS)} — harga saat ini cukup jauh di bawah nilai wajar.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
