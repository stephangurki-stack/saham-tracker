import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { LOT_SIZE } from '../lib/portfolio'
import type { Dividend, DividendTarget, Security } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtPct = (n: number) => (n * 100).toFixed(2) + '%'

export default function Dividen() {
  const { user } = useAuth()
  const { holdingsGabungan, holdingsBySecurity } = usePortfolioData()

  const [securities, setSecurities] = useState<Security[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [targets, setTargets] = useState<DividendTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [targetInput, setTargetInput] = useState('')
  const [savingTarget, setSavingTarget] = useState(false)

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

  async function load() {
    setLoading(true)
    const [secRes, divRes, targetRes] = await Promise.all([
      supabase.from('securities').select('*').order('created_at', { ascending: true }),
      supabase.from('dividends').select('*').order('tanggal_bayar', { ascending: false }),
      supabase.from('dividend_targets').select('*'),
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

    const { error: divErr } = await supabase.from('dividends').insert({
      user_id: user.id,
      security_id: securityId,
      ticker: tickerUpper,
      tanggal_bayar: tanggalBayar,
      jumlah_per_lembar: perLembarNum,
      lot: lot ? Number(lot) : null,
      total: totalNum,
    })

    if (divErr) setError(divErr.message)
    else {
      setTicker('')
      setJumlahPerLembar('')
      setLot('')
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

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Dividen</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-slate-400">Realisasi {currentYear}</p>
            <p className="text-xl font-semibold text-emerald-400">{fmtRp(totalTahunIni)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Target {currentYear}</p>
            <p className="text-xl font-semibold">{targetTahunIni ? fmtRp(targetTahunIni) : '-'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Realisasi %</p>
            <p className={`text-xl font-semibold ${realisasiPct !== null && realisasiPct >= 1 ? 'text-emerald-400' : ''}`}>
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
            className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
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
                onChange={(e) => handleSecurityChange(e.target.value)}
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
              {heldForSecurity.length > 0 ? (
                <select
                  value={heldForSecurity.some((h) => h.ticker === ticker) ? ticker : '__manual__'}
                  onChange={(e) =>
                    e.target.value === '__manual__' ? setTicker('') : handleTickerChange(e.target.value)
                  }
                  className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
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
                  className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100 uppercase"
                />
              )}
              {heldForSecurity.length > 0 && !heldForSecurity.some((h) => h.ticker === ticker) && (
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="Ketik ticker"
                  className="w-full mt-2 rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100 uppercase"
                />
              )}
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
              <label className="block text-xs text-slate-400 mb-1">Lot</label>
              <input
                type="number"
                value={lot}
                onChange={(e) => handleLotChange(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rp / Lembar</label>
              <input
                type="number"
                value={jumlahPerLembar}
                onChange={(e) => handlePerLembarChange(e.target.value)}
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
              <p className="text-xs text-slate-500 mt-1">Auto dari Lot × Rp/Lembar, bisa diedit (mis. setelah pajak)</p>
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

      {rekapPerSaham.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-300 mb-1">Rekap Dividen per Saham</p>
          <p className="text-xs text-slate-500 mb-2">
            Yield dihitung terhadap cost basis (modal tertanam) saham tersebut saat ini
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400 text-left">
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
                  <tr key={r.ticker} className="border-t border-slate-800">
                    <td className="py-1 pr-2 font-medium">{r.ticker}</td>
                    <td className="py-1 pr-2 text-right">{fmtRp(r.totalDiterima)}</td>
                    <td className="py-1 pr-2 text-right">{r.yieldTotalPct !== null ? fmtPct(r.yieldTotalPct) : '-'}</td>
                    <td className="py-1 pr-2 text-right">{fmtRp(r.tahunIni)}</td>
                    <td className="py-1 text-right">{r.yieldTahunIniPct !== null ? fmtPct(r.yieldTahunIniPct) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tahunSorted.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-slate-300 mb-2">Rekap per Tahun</p>
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left">
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
                  <tr key={year} className="border-t border-slate-800">
                    <td className="py-1 pr-2">{year}</td>
                    <td className="py-1 pr-2 text-right">{fmtRp(perTahun.get(year)!)}</td>
                    <td className="py-1 pr-2 text-right">{target ? fmtRp(target) : '-'}</td>
                    <td className={`py-1 text-right ${pct !== null && pct >= 1 ? 'text-emerald-400' : ''}`}>
                      {pct !== null ? fmtPct(pct) : '-'}
                    </td>
                  </tr>
                )
              })}
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
                <th className="py-1 pr-2">Lot</th>
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
                  <td className="py-1 pr-2">{d.lot ?? '-'}</td>
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
