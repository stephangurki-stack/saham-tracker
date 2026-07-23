import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { PeriodeTipe, StockAnalysis } from '../lib/types'

const currentYear = new Date().getFullYear()

function periodeLabel(a: StockAnalysis): string {
  return a.periode_tipe === 'tahunan' ? `${a.tahun} Tahunan` : `${a.tahun} Triwulan ${a.triwulan}`
}

export default function Analisa() {
  const { user } = useAuth()
  const [analyses, setAnalyses] = useState<StockAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [ticker, setTicker] = useState('')
  const [periodeTipe, setPeriodeTipe] = useState<PeriodeTipe>('tahunan')
  const [tahun, setTahun] = useState(String(currentYear))
  const [triwulan, setTriwulan] = useState('1')
  const [judul, setJudul] = useState('')
  const [catatan, setCatatan] = useState('')

  const [filterTicker, setFilterTicker] = useState('semua')
  const [filterTahun, setFilterTahun] = useState('semua')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('stock_analyses')
      .select('*')
      .order('tahun', { ascending: false })
      .order('triwulan', { ascending: false })
    if (error) setError(error.message)
    else setAnalyses(data as StockAnalysis[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setEditingId(null)
    setTicker('')
    setPeriodeTipe('tahunan')
    setTahun(String(currentYear))
    setTriwulan('1')
    setJudul('')
    setCatatan('')
  }

  function startEdit(a: StockAnalysis) {
    setError(null)
    setEditingId(a.id)
    setTicker(a.ticker)
    setPeriodeTipe(a.periode_tipe)
    setTahun(String(a.tahun))
    setTriwulan(String(a.triwulan ?? 1))
    setJudul(a.judul ?? '')
    setCatatan(a.catatan)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const tickerUpper = ticker.trim().toUpperCase()
    const tahunNum = Number(tahun)
    if (!tickerUpper || !tahunNum || !catatan.trim()) {
      setError('Isi ticker, tahun, dan catatan.')
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

    const payload = {
      user_id: user.id,
      ticker: tickerUpper,
      periode_tipe: periodeTipe,
      tahun: tahunNum,
      triwulan: periodeTipe === 'triwulan' ? Number(triwulan) : null,
      judul: judul.trim() || null,
      catatan: catatan.trim(),
      updated_at: new Date().toISOString(),
    }

    const { error: saveErr } = editingId
      ? await supabase.from('stock_analyses').update(payload).eq('id', editingId)
      : await supabase.from('stock_analyses').insert(payload)

    if (saveErr) setError(saveErr.message)
    else {
      resetForm()
      load()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus catatan analisa ini?')) return
    const { error } = await supabase.from('stock_analyses').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const tickers = [...new Set(analyses.map((a) => a.ticker))].sort()
  const tahunList = [...new Set(analyses.map((a) => a.tahun))].sort((a, b) => b - a)

  const filtered = analyses.filter((a) => {
    if (filterTicker !== 'semua' && a.ticker !== filterTicker) return false
    if (filterTahun !== 'semua' && String(a.tahun) !== filterTahun) return false
    return true
  })

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Analisa Laporan Keuangan</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 mb-6 space-y-3">
        {editingId && (
          <p className="text-xs text-blue-600">
            Mengedit catatan {ticker}.{' '}
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
              className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900 uppercase"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Jenis Periode</label>
            <select
              value={periodeTipe}
              onChange={(e) => setPeriodeTipe(e.target.value as PeriodeTipe)}
              className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
            >
              <option value="tahunan">Tahunan</option>
              <option value="triwulan">Triwulan</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Tahun</label>
            <input
              type="number"
              value={tahun}
              onChange={(e) => setTahun(e.target.value)}
              className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
            />
          </div>
          {periodeTipe === 'triwulan' && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Triwulan</label>
              <select
                value={triwulan}
                onChange={(e) => setTriwulan(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              >
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">Judul (opsional)</label>
          <input
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="mis. Kinerja solid, margin membaik"
            className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-1">Catatan / Ringkasan Analisa</label>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={5}
            className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2"
        >
          {editingId ? 'Update Analisa' : 'Simpan Analisa'}
        </button>
      </form>

      <div className="flex gap-2 mb-4">
        <select
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          className="rounded-md bg-slate-100 border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
        >
          <option value="semua">Semua Ticker</option>
          {tickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filterTahun}
          onChange={(e) => setFilterTahun(e.target.value)}
          className="rounded-md bg-slate-100 border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
        >
          <option value="semua">Semua Tahun</option>
          {tahunList.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-slate-600 text-sm">Memuat...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-600 text-sm">Belum ada catatan analisa.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.ticker}</span>
                  <span className="text-xs text-slate-400">{periodeLabel(a)}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => startEdit(a)} className="text-blue-600 hover:text-blue-700">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-700">
                    Hapus
                  </button>
                </div>
              </div>
              {a.judul && <p className="text-sm font-medium text-slate-800 mb-1">{a.judul}</p>}
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{a.catatan}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
