import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import type { Dividend, Security } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtPct = (n: number) => (n * 100).toFixed(2) + '%'

export default function Dividen() {
  const { user } = useAuth()
  const { holdingsGabungan } = usePortfolioData()

  const [securities, setSecurities] = useState<Security[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [securityId, setSecurityId] = useState('')
  const [ticker, setTicker] = useState('')
  const [tanggalBayar, setTanggalBayar] = useState(todayISO())
  const [jumlahPerLembar, setJumlahPerLembar] = useState('')
  const [total, setTotal] = useState('')

  async function load() {
    setLoading(true)
    const [secRes, divRes] = await Promise.all([
      supabase.from('securities').select('*').order('created_at', { ascending: true }),
      supabase.from('dividends').select('*').order('tanggal_bayar', { ascending: false }),
    ])
    if (secRes.error) setError(secRes.error.message)
    else {
      setSecurities(secRes.data as Security[])
      if (!securityId && secRes.data.length > 0) setSecurityId(secRes.data[0].id)
    }
    if (divRes.error) setError(divRes.error.message)
    else setDividends(divRes.data as Dividend[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const tickerUpper = ticker.trim().toUpperCase()
    const perLembarNum = Number(jumlahPerLembar)
    const totalNum = Number(total)

    if (!securityId || !tickerUpper || !perLembarNum || !totalNum) {
      setError('Isi semua field yang wajib (sekuritas, ticker, jumlah per lembar, total).')
      return
    }
    if (!user) return

    setSubmitting(true)

    const { error: stockErr } = await supabase
      .from('stocks')
      .upsert({ ticker: tickerUpper }, { onConflict: 'ticker', ignoreDuplicates: true })
    if (stockErr) {
      setError(stockErr.message)
      setSubmitting(false)
      return
    }

    const { error: divErr } = await supabase.from('dividends').insert({
      user_id: user.id,
      security_id: securityId,
      ticker: tickerUpper,
      tanggal_bayar: tanggalBayar,
      jumlah_per_lembar: perLembarNum,
      total: totalNum,
    })

    if (divErr) setError(divErr.message)
    else {
      setTicker('')
      setJumlahPerLembar('')
      setTotal('')
      load()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus catatan dividen ini?')) return
    const { error } = await supabase.from('dividends').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const securityName = (id: string) => securities.find((s) => s.id === id)?.nama ?? '-'

  const currentYear = new Date().getFullYear()
  const totalTahunIni = dividends
    .filter((d) => new Date(d.tanggal_bayar).getFullYear() === currentYear)
    .reduce((s, d) => s + d.total, 0)

  const perTahun = new Map<number, number>()
  for (const d of dividends) {
    const year = new Date(d.tanggal_bayar).getFullYear()
    perTahun.set(year, (perTahun.get(year) ?? 0) + d.total)
  }
  const tahunSorted = [...perTahun.keys()].sort((a, b) => b - a)

  const perSaham = new Map<string, number>()
  for (const d of dividends) {
    perSaham.set(d.ticker, (perSaham.get(d.ticker) ?? 0) + d.total)
  }
  const yieldOnCost = [...perSaham.entries()].map(([tk, totalDiterima]) => {
    const holding = holdingsGabungan.find((h) => h.ticker === tk && h.lot > 0)
    const yieldPct = holding && holding.costBasis > 0 ? totalDiterima / holding.costBasis : null
    return { ticker: tk, totalDiterima, yieldPct }
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Dividen</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <p className="text-xs text-slate-400">Total Dividen Tahun {currentYear}</p>
        <p className="text-xl font-semibold text-emerald-400">{fmtRp(totalTahunIni)}</p>
      </div>

      {securities.length === 0 && !loading ? (
        <p className="text-sm text-amber-400 mb-4">
          Belum ada akun sekuritas. Tambahkan dulu di halaman Sekuritas.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sekuritas</label>
              <select
                value={securityId}
                onChange={(e) => setSecurityId(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              >
                {securities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
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
              <label className="block text-xs text-slate-400 mb-1">Tanggal Bayar</label>
              <input
                type="date"
                value={tanggalBayar}
                onChange={(e) => setTanggalBayar(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rp / Lembar</label>
              <input
                type="number"
                value={jumlahPerLembar}
                onChange={(e) => setJumlahPerLembar(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Diterima (Rp)</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2"
          >
            Catat Dividen
          </button>
        </form>
      )}

      {yieldOnCost.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-300 mb-2">Dividend Yield on Cost per Saham</p>
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left">
              <tr>
                <th className="py-1 pr-2">Ticker</th>
                <th className="py-1 pr-2">Total Diterima</th>
                <th className="py-1">Yield on Cost</th>
              </tr>
            </thead>
            <tbody>
              {yieldOnCost.map((y) => (
                <tr key={y.ticker} className="border-t border-slate-800">
                  <td className="py-1 pr-2 font-medium">{y.ticker}</td>
                  <td className="py-1 pr-2">{fmtRp(y.totalDiterima)}</td>
                  <td className="py-1">{y.yieldPct !== null ? fmtPct(y.yieldPct) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tahunSorted.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-300 mb-2">Rekap per Tahun</p>
          <table className="w-full text-sm">
            <tbody>
              {tahunSorted.map((year) => (
                <tr key={year} className="border-t border-slate-800">
                  <td className="py-1 pr-2">{year}</td>
                  <td className="py-1 text-right">{fmtRp(perTahun.get(year)!)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-sm font-medium text-slate-300 mb-2">Riwayat Dividen</h2>
      {loading ? (
        <p className="text-slate-400 text-sm">Memuat...</p>
      ) : dividends.length === 0 ? (
        <p className="text-slate-400 text-sm">Belum ada catatan dividen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left">
              <tr>
                <th className="py-1 pr-2">Tanggal Bayar</th>
                <th className="py-1 pr-2">Ticker</th>
                <th className="py-1 pr-2">Rp/Lembar</th>
                <th className="py-1 pr-2">Total</th>
                <th className="py-1 pr-2">Sekuritas</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d) => (
                <tr key={d.id} className="border-t border-slate-800">
                  <td className="py-1 pr-2">{d.tanggal_bayar}</td>
                  <td className="py-1 pr-2 font-medium">{d.ticker}</td>
                  <td className="py-1 pr-2">{fmtRp(d.jumlah_per_lembar)}</td>
                  <td className="py-1 pr-2">{fmtRp(d.total)}</td>
                  <td className="py-1 pr-2">{securityName(d.security_id)}</td>
                  <td className="py-1">
                    <button onClick={() => handleDelete(d.id)} className="text-red-400 hover:text-red-300">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
