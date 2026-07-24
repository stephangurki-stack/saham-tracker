import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { LOT_SIZE } from '../lib/portfolio'
import type { Dividend, DividendProjection, DividendTarget, Security } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtPct = (n: number) => (n * 100).toFixed(2) + '%'

export default function Dividen() {
  const { user } = useAuth()
  const { holdingsGabungan, holdingsBySecurity } = usePortfolioData()
  const { hidden } = usePrivacyMode()
  const fmtNum = (n: number) => (hidden ? '••••••' : Math.round(n).toLocaleString('id-ID'))

  const [securities, setSecurities] = useState<Security[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [targets, setTargets] = useState<DividendTarget[]>([])
  const [projections, setProjections] = useState<DividendProjection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [targetInput, setTargetInput] = useState('')
  const [savingTarget, setSavingTarget] = useState(false)
  const [editingProjectionTicker, setEditingProjectionTicker] = useState<string | null>(null)
  const [projectionInput, setProjectionInput] = useState('')
  const [savingProjection, setSavingProjection] = useState(false)

  const [securityId, setSecurityId] = useState('')
  const [ticker, setTicker] = useState('')
  const [tanggalBayar, setTanggalBayar] = useState(todayISO())
  const [jumlahPerLembar, setJumlahPerLembar] = useState('')
  const [lot, setLot] = useState('')
  const [total, setTotal] = useState('')

  const heldForSecurity = holdingsBySecurity.filter((h) => h.security_id === securityId && h.lot > 0)

  function handleSecurityChange(id: string) {
    setSecurityId(id)
    const held = holdingsBySecurity.filter((h) => h.security_id === id && h.lot > 0)
    if (held.length > 0) {
      setTicker(held[0].ticker)
      setLot(String(held[0].lot))
    } else {
      setTicker('')
      setLot('')
    }
  }

  function handleTickerChange(tk: string) {
    setTicker(tk)
    const held = heldForSecurity.find((h) => h.ticker === tk)
    if (held) setLot(String(held.lot))
  }

  function recalcTotal(perLembarStr: string, lotStr: string) {
    const perLembarNum = Number(perLembarStr)
    const lotNum = Number(lotStr)
    if (perLembarNum > 0 && lotNum > 0) {
      setTotal(String(Math.round(perLembarNum * lotNum * LOT_SIZE)))
    }
  }

  function handlePerLembarChange(value: string) {
    setJumlahPerLembar(value)
    recalcTotal(value, lot)
  }

  function handleLotChange(value: string) {
    setLot(value)
    recalcTotal(jumlahPerLembar, value)
  }

  function resetForm() {
    setEditingId(null)
    setTicker('')
    setTanggalBayar(todayISO())
    setJumlahPerLembar('')
    setLot('')
    setTotal('')
  }

  function startEdit(d: Dividend) {
    setError(null)
    setEditingId(d.id)
    setSecurityId(d.security_id)
    setTicker(d.ticker)
    setTanggalBayar(d.tanggal_bayar)
    setJumlahPerLembar(String(d.jumlah_per_lembar))
    setLot(d.lot !== null ? String(d.lot) : '')
    setTotal(String(d.total))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function load() {
    setLoading(true)
    const [secRes, divRes, targetRes, projectionRes] = await Promise.all([
      supabase.from('securities').select('*').order('created_at', { ascending: true }),
      supabase.from('dividends').select('*').order('tanggal_bayar', { ascending: false }),
      supabase.from('dividend_targets').select('*'),
      supabase.from('dividend_projections').select('*'),
    ])
    if (secRes.error) setError(secRes.error.message)
    else {
      setSecurities(secRes.data as Security[])
      if (!securityId && secRes.data.length > 0) setSecurityId(secRes.data[0].id)
    }
    if (divRes.error) setError(divRes.error.message)
    else setDividends(divRes.data as Dividend[])
    if (targetRes.error) setError(targetRes.error.message)
    else {
      const targetData = targetRes.data as DividendTarget[]
      setTargets(targetData)
      const thisYearTarget = targetData.find((t) => t.tahun === new Date().getFullYear())
      if (thisYearTarget) setTargetInput(String(thisYearTarget.target))
    }
    if (projectionRes.error) setError(projectionRes.error.message)
    else setProjections(projectionRes.data as DividendProjection[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Default ticker/lot to the first held position once securities & holdings are ready.
  useEffect(() => {
    if (!ticker && securityId) {
      const held = holdingsBySecurity.filter((h) => h.security_id === securityId && h.lot > 0)
      if (held.length > 0) {
        setTicker(held[0].ticker)
        setLot(String(held[0].lot))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [securityId, holdingsBySecurity])

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

    const payload = {
      user_id: user.id,
      security_id: securityId,
      ticker: tickerUpper,
      tanggal_bayar: tanggalBayar,
      jumlah_per_lembar: perLembarNum,
      lot: lot ? Number(lot) : null,
      total: totalNum,
    }

    const { error: divErr } = editingId
      ? await supabase.from('dividends').update(payload).eq('id', editingId)
      : await supabase.from('dividends').insert(payload)

    if (divErr) setError(divErr.message)
    else {
      resetForm()
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

  async function handleSaveTarget() {
    setError(null)
    const targetNum = Number(targetInput)
    if (!targetNum || !user) {
      setError('Isi target dividen dengan angka valid.')
      return
    }
    setSavingTarget(true)
    const { error } = await supabase
      .from('dividend_targets')
      .upsert(
        { user_id: user.id, tahun: new Date().getFullYear(), target: targetNum, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,tahun' }
      )
    if (error) setError(error.message)
    else load()
    setSavingTarget(false)
  }

  function startEditProjection(tk: string, currentValue: number) {
    setEditingProjectionTicker(tk)
    setProjectionInput(String(Math.round(currentValue)))
  }

  async function handleSaveProjection(tk: string) {
    setError(null)
    const jumlahNum = Number(projectionInput)
    if (!user || jumlahNum < 0 || projectionInput === '') {
      setError('Isi proyeksi dengan angka valid.')
      return
    }
    setSavingProjection(true)
    const { error } = await supabase.from('dividend_projections').upsert(
      {
        user_id: user.id,
        ticker: tk,
        tahun: currentYear + 1,
        jumlah: jumlahNum,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,ticker,tahun' }
    )
    if (error) setError(error.message)
    else {
      setEditingProjectionTicker(null)
      await load()
    }
    setSavingProjection(false)
  }

  async function handleResetProjection(tk: string) {
    if (!confirm(`Kembalikan proyeksi ${tk} ke perhitungan otomatis?`)) return
    const { error } = await supabase
      .from('dividend_projections')
      .delete()
      .eq('ticker', tk)
      .eq('tahun', currentYear + 1)
    if (error) setError(error.message)
    else load()
  }

  const securityName = (id: string) => securities.find((s) => s.id === id)?.nama ?? '-'

  const currentYear = new Date().getFullYear()
  const totalTahunIni = dividends
    .filter((d) => new Date(d.tanggal_bayar).getFullYear() === currentYear)
    .reduce((s, d) => s + d.total, 0)

  const targetByYear = new Map(targets.map((t) => [t.tahun, t.target]))
  const targetTahunIni = targetByYear.get(currentYear) ?? null
  const realisasiPct = targetTahunIni ? totalTahunIni / targetTahunIni : null

  const perTahun = new Map<number, number>()
  for (const d of dividends) {
    const year = new Date(d.tanggal_bayar).getFullYear()
    perTahun.set(year, (perTahun.get(year) ?? 0) + d.total)
  }
  const tahunSorted = [...perTahun.keys()].sort((a, b) => b - a)

  const perSahamTotal = new Map<string, number>()
  const perSahamTahunIni = new Map<string, number>()
  for (const d of dividends) {
    perSahamTotal.set(d.ticker, (perSahamTotal.get(d.ticker) ?? 0) + d.total)
    if (new Date(d.tanggal_bayar).getFullYear() === currentYear) {
      perSahamTahunIni.set(d.ticker, (perSahamTahunIni.get(d.ticker) ?? 0) + d.total)
    }
  }
  const rekapPerSaham = [...perSahamTotal.entries()].map(([tk, totalDiterima]) => {
    const holding = holdingsGabungan.find((h) => h.ticker === tk && h.lot > 0)
    const costBasis = holding && holding.costBasis > 0 ? holding.costBasis : null
    const tahunIni = perSahamTahunIni.get(tk) ?? 0
    return {
      ticker: tk,
      costBasis,
      totalDiterima,
      yieldTotalPct: costBasis ? totalDiterima / costBasis : null,
      tahunIni,
      yieldTahunIniPct: costBasis ? tahunIni / costBasis : null,
    }
  })

  // Projected next-year dividend = current combined lot per ticker × this year's
  // realized dividend-per-share rate (total received ÷ lot it was paid on, weighted
  // in case a ticker had multiple payouts/accounts this year at different rates).
  // A manual override in dividend_projections replaces the auto-calculated value.
  const projectionByTicker = new Map(
    projections.filter((p) => p.tahun === currentYear + 1).map((p) => [p.ticker, p.jumlah])
  )
  const projeksiPerSaham = holdingsGabungan
    .filter((h) => h.lot > 0)
    .map((h) => {
      const divsTahunIni = dividends.filter(
        (d) => d.ticker === h.ticker && new Date(d.tanggal_bayar).getFullYear() === currentYear && d.lot
      )
      const totalReceived = divsTahunIni.reduce((s, d) => s + d.total, 0)
      const totalLotDasar = divsTahunIni.reduce((s, d) => s + (d.lot ?? 0), 0)
      const perLembar = totalLotDasar > 0 ? totalReceived / (totalLotDasar * LOT_SIZE) : null
      const auto = perLembar !== null ? perLembar * h.lot * LOT_SIZE : null
      const manual = projectionByTicker.get(h.ticker) ?? null
      return {
        ticker: h.ticker,
        lot: h.lot,
        perLembar,
        auto,
        proyeksi: manual ?? auto,
        isManual: manual !== null,
      }
    })
    .filter((r) => r.proyeksi !== null)
    .sort((a, b) => (b.proyeksi ?? 0) - (a.proyeksi ?? 0))
  const totalProyeksi = projeksiPerSaham.reduce((s, r) => s + (r.proyeksi ?? 0), 0)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-1">Dividen</h1>
      <p className="text-xs text-slate-400 mb-4">Semua nilai dalam Rupiah (Rp)</p>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-slate-600">Realisasi {currentYear}</p>
            <p className="text-xl font-semibold text-emerald-600">{fmtNum(totalTahunIni)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Target {currentYear}</p>
            <p className="text-xl font-semibold">{targetTahunIni ? fmtNum(targetTahunIni) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Realisasi %</p>
            <p className={`text-xl font-semibold ${realisasiPct !== null && realisasiPct >= 1 ? 'text-emerald-600' : ''}`}>
              {realisasiPct !== null ? fmtPct(realisasiPct) : '-'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder={`Set target dividen ${currentYear} (Rp)`}
            className="flex-1 rounded-md bg-slate-100 border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
          />
          <button
            onClick={handleSaveTarget}
            disabled={savingTarget}
            className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-3 py-1.5"
          >
            Simpan Target
          </button>
        </div>
      </div>

      {securities.length === 0 && !loading ? (
        <p className="text-sm text-amber-600 mb-4">
          Belum ada akun sekuritas. Tambahkan dulu di halaman Sekuritas.
        </p>
      ) : (
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
              <label className="block text-xs text-slate-600 mb-1">Sekuritas</label>
              <select
                value={securityId}
                onChange={(e) => handleSecurityChange(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              >
                {securities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Ticker</label>
              {heldForSecurity.length > 0 ? (
                <select
                  value={heldForSecurity.some((h) => h.ticker === ticker) ? ticker : '__manual__'}
                  onChange={(e) =>
                    e.target.value === '__manual__' ? setTicker('') : handleTickerChange(e.target.value)
                  }
                  className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
                >
                  {heldForSecurity.map((h) => (
                    <option key={h.ticker} value={h.ticker}>
                      {h.ticker} ({h.lot} lot)
                    </option>
                  ))}
                  <option value="__manual__">Ticker lain (ketik manual)</option>
                </select>
              ) : (
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="BBCA"
                  className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900 uppercase"
                />
              )}
              {heldForSecurity.length > 0 && !heldForSecurity.some((h) => h.ticker === ticker) && (
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="Ketik ticker"
                  className="w-full mt-2 rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900 uppercase"
                />
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Tanggal Bayar</label>
              <input
                type="date"
                value={tanggalBayar}
                onChange={(e) => setTanggalBayar(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Lot</label>
              <input
                type="number"
                value={lot}
                onChange={(e) => handleLotChange(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Rp / Lembar</label>
              <input
                type="number"
                value={jumlahPerLembar}
                onChange={(e) => handlePerLembarChange(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Total Diterima (Rp)</label>
              <input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
              <p className="text-xs text-slate-400 mt-1">Auto dari Lot × Rp/Lembar, bisa diedit (mis. setelah pajak)</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2"
          >
            {editingId ? 'Update Dividen' : 'Catat Dividen'}
          </button>
        </form>
      )}

      {rekapPerSaham.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-700 mb-1">Rekap Dividen per Saham</p>
          <p className="text-xs text-slate-400 mb-2">
            Yield dihitung terhadap cost basis (modal tertanam) saham tersebut saat ini
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-600 text-left">
                <tr>
                  <th className="py-1 pr-2">Ticker</th>
                  <th className="py-1 pr-2 text-right">Total Dividen</th>
                  <th className="py-1 pr-2 text-right">Yield (Total)</th>
                  <th className="py-1 pr-2 text-right">Dividen {currentYear}</th>
                  <th className="py-1 text-right">Yield ({currentYear})</th>
                </tr>
              </thead>
              <tbody>
                {rekapPerSaham.map((r) => (
                  <tr key={r.ticker} className="border-t border-slate-200">
                    <td className="py-1 pr-2 font-medium">{r.ticker}</td>
                    <td className="py-1 pr-2 text-right">{fmtNum(r.totalDiterima)}</td>
                    <td className="py-1 pr-2 text-right">{r.yieldTotalPct !== null ? fmtPct(r.yieldTotalPct) : '-'}</td>
                    <td className="py-1 pr-2 text-right">{fmtNum(r.tahunIni)}</td>
                    <td className="py-1 text-right">{r.yieldTahunIniPct !== null ? fmtPct(r.yieldTahunIniPct) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tahunSorted.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-700 mb-2">Rekap per Tahun</p>
          <table className="w-full text-sm">
            <thead className="text-slate-600 text-left">
              <tr>
                <th className="py-1 pr-2">Tahun</th>
                <th className="py-1 pr-2 text-right">Realisasi</th>
                <th className="py-1 pr-2 text-right">Target</th>
                <th className="py-1 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {tahunSorted.map((year) => {
                const target = targetByYear.get(year) ?? null
                const pct = target ? perTahun.get(year)! / target : null
                return (
                  <tr key={year} className="border-t border-slate-200">
                    <td className="py-1 pr-2">{year}</td>
                    <td className="py-1 pr-2 text-right">{fmtNum(perTahun.get(year)!)}</td>
                    <td className="py-1 pr-2 text-right">{target ? fmtNum(target) : '-'}</td>
                    <td className={`py-1 text-right ${pct !== null && pct >= 1 ? 'text-emerald-600' : ''}`}>
                      {pct !== null ? fmtPct(pct) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {projeksiPerSaham.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-700 mb-1">Proyeksi Dividen {currentYear + 1}</p>
          <p className="text-xs text-slate-400 mb-3">
            Lot pada portofolio gabungan saat ini × dividen per lembar yang sudah diterima tahun {currentYear}
          </p>
          <p className="text-xl font-semibold text-emerald-600 mb-3">{fmtNum(totalProyeksi)}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-600 text-left">
                <tr>
                  <th className="py-1 pr-2">Ticker</th>
                  <th className="py-1 pr-2 text-right">Lot</th>
                  <th className="py-1 pr-2 text-right">Rp/Lembar ({currentYear})</th>
                  <th className="py-1 pr-2 text-right">Proyeksi</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {projeksiPerSaham.map((r) => (
                  <tr key={r.ticker} className="border-t border-slate-200">
                    <td className="py-1 pr-2 font-medium">{r.ticker}</td>
                    <td className="py-1 pr-2 text-right">{r.lot}</td>
                    <td className="py-1 pr-2 text-right">{fmtNum(r.perLembar ?? 0)}</td>
                    <td className="py-1 pr-2 text-right">
                      {editingProjectionTicker === r.ticker ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={projectionInput}
                            onChange={(e) => setProjectionInput(e.target.value)}
                            className="w-28 rounded-md bg-slate-100 border border-slate-300 px-2 py-1 text-sm text-slate-900 text-right"
                          />
                        </div>
                      ) : (
                        <>
                          {fmtNum(r.proyeksi ?? 0)}
                          {r.isManual && <span className="text-xs text-blue-600 ml-1">(manual)</span>}
                        </>
                      )}
                    </td>
                    <td className="py-1 whitespace-nowrap">
                      {editingProjectionTicker === r.ticker ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveProjection(r.ticker)}
                            disabled={savingProjection}
                            className="text-blue-600 hover:text-blue-700 text-xs"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setEditingProjectionTicker(null)}
                            className="text-slate-600 hover:text-slate-800 text-xs"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditProjection(r.ticker, r.proyeksi ?? 0)}
                            className="text-blue-600 hover:text-blue-700 text-xs"
                          >
                            Edit
                          </button>
                          {r.isManual && (
                            <button
                              onClick={() => handleResetProjection(r.ticker)}
                              className="text-slate-600 hover:text-slate-800 text-xs"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="text-sm font-medium text-slate-700 mb-2">Riwayat Dividen</h2>
      {loading ? (
        <p className="text-slate-600 text-sm">Memuat...</p>
      ) : dividends.length === 0 ? (
        <p className="text-slate-600 text-sm">Belum ada catatan dividen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 text-left">
              <tr>
                <th className="py-1 pr-2">Tanggal Bayar</th>
                <th className="py-1 pr-2">Ticker</th>
                <th className="py-1 pr-2">Lot</th>
                <th className="py-1 pr-2">Rp/Lembar</th>
                <th className="py-1 pr-2">Total</th>
                <th className="py-1 pr-2">Sekuritas</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d) => (
                <tr key={d.id} className="border-t border-slate-200">
                  <td className="py-1 pr-2">{d.tanggal_bayar}</td>
                  <td className="py-1 pr-2 font-medium">{d.ticker}</td>
                  <td className="py-1 pr-2">{d.lot ?? '-'}</td>
                  <td className="py-1 pr-2">{fmtNum(d.jumlah_per_lembar)}</td>
                  <td className="py-1 pr-2">{fmtNum(d.total)}</td>
                  <td className="py-1 pr-2">{securityName(d.security_id)}</td>
                  <td className="py-1 whitespace-nowrap">
                    <button onClick={() => startEdit(d)} className="text-blue-600 hover:text-blue-700 mr-3">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(d.id)} className="text-red-600 hover:text-red-700">
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
