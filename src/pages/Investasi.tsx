import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { marketValue } from '../lib/portfolio'
import { xirr } from '../lib/xirr'
import type { CashFlow, CashFlowType, Security } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtRp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'

export default function Investasi() {
  const { user } = useAuth()
  const { holdingsGabungan, prices } = usePortfolioData()

  const [securities, setSecurities] = useState<Security[]>([])
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [securityId, setSecurityId] = useState('')
  const [tipe, setTipe] = useState<CashFlowType>('deposit')
  const [tanggal, setTanggal] = useState(todayISO())
  const [jumlah, setJumlah] = useState('')

  async function load() {
    setLoading(true)
    const [secRes, cfRes] = await Promise.all([
      supabase.from('securities').select('*').order('created_at', { ascending: true }),
      supabase.from('cash_flows').select('*').order('tanggal', { ascending: false }),
    ])
    if (secRes.error) setError(secRes.error.message)
    else {
      setSecurities(secRes.data as Security[])
      if (!securityId && secRes.data.length > 0) setSecurityId(secRes.data[0].id)
    }
    if (cfRes.error) setError(cfRes.error.message)
    else setCashFlows(cfRes.data as CashFlow[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const jumlahNum = Number(jumlah)
    if (!securityId || !jumlahNum) {
      setError('Isi semua field (sekuritas, jumlah).')
      return
    }
    if (!user) return

    setSubmitting(true)
    const { error } = await supabase.from('cash_flows').insert({
      user_id: user.id,
      security_id: securityId,
      tipe,
      tanggal,
      jumlah: jumlahNum,
    })
    if (error) setError(error.message)
    else {
      setJumlah('')
      load()
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus catatan ini?')) return
    const { error } = await supabase.from('cash_flows').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const securityName = (id: string) => securities.find((s) => s.id === id)?.nama ?? '-'

  const totalDeposit = cashFlows.filter((c) => c.tipe === 'deposit').reduce((s, c) => s + c.jumlah, 0)
  const totalWithdraw = cashFlows.filter((c) => c.tipe === 'withdraw').reduce((s, c) => s + c.jumlah, 0)
  const netDeposited = totalDeposit - totalWithdraw

  const currentValue = holdingsGabungan
    .filter((h) => h.lot > 0)
    .reduce((sum, h) => sum + marketValue(h, prices[h.ticker] ?? 0), 0)

  const totalReturn = netDeposited > 0 ? (currentValue - netDeposited) / netDeposited : null

  const xirrValue =
    cashFlows.length > 0
      ? xirr([
          ...cashFlows.map((c) => ({
            date: new Date(c.tanggal),
            amount: c.tipe === 'deposit' ? -c.jumlah : c.jumlah,
          })),
          { date: new Date(), amount: currentValue },
        ])
      : null

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Investasi</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Modal Disetor (Net)</p>
          <p className="text-xl font-semibold">{fmtRp(netDeposited)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Nilai Portofolio Sekarang</p>
          <p className="text-xl font-semibold">{fmtRp(currentValue)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">Total Return</p>
          <p className={`text-xl font-semibold ${totalReturn !== null && totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalReturn !== null ? fmtPct(totalReturn) : '-'}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-400">XIRR (Annualized)</p>
          <p className={`text-xl font-semibold ${xirrValue !== null && xirrValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {xirrValue !== null ? fmtPct(xirrValue) : '-'}
          </p>
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
              <label className="block text-xs text-slate-400 mb-1">Tipe</label>
              <select
                value={tipe}
                onChange={(e) => setTipe(e.target.value as CashFlowType)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              >
                <option value="deposit">Setor</option>
                <option value="withdraw">Tarik</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tanggal</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Jumlah (Rp)</label>
              <input
                type="number"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
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
            Catat
          </button>
        </form>
      )}

      <h2 className="text-sm font-medium text-slate-300 mb-2">Riwayat Setoran/Penarikan</h2>
      {loading ? (
        <p className="text-slate-400 text-sm">Memuat...</p>
      ) : cashFlows.length === 0 ? (
        <p className="text-slate-400 text-sm">Belum ada catatan.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400 text-left">
              <tr>
                <th className="py-1 pr-2">Tanggal</th>
                <th className="py-1 pr-2">Tipe</th>
                <th className="py-1 pr-2">Jumlah</th>
                <th className="py-1 pr-2">Sekuritas</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {cashFlows.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="py-1 pr-2">{c.tanggal}</td>
                  <td className={`py-1 pr-2 ${c.tipe === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c.tipe === 'deposit' ? 'Setor' : 'Tarik'}
                  </td>
                  <td className="py-1 pr-2">{fmtRp(c.jumlah)}</td>
                  <td className="py-1 pr-2">{securityName(c.security_id)}</td>
                  <td className="py-1">
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300">
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
