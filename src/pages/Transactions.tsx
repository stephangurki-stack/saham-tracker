import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import type { Security, Transaction, TransactionType } from '../lib/types'

const todayISO = () => new Date().toISOString().slice(0, 10)

export default function Transactions() {
  const { user } = useAuth()
  const { hidden } = usePrivacyMode()
  const fmtNum = (n: number) => (hidden ? '••••••' : n.toLocaleString('id-ID'))
  const [securities, setSecurities] = useState<Security[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [securityId, setSecurityId] = useState('')
  const [ticker, setTicker] = useState('')
  const [tipe, setTipe] = useState<TransactionType>('buy')
  const [tanggal, setTanggal] = useState(todayISO())
  const [harga, setHarga] = useState('')
  const [lot, setLot] = useState('')
  const [fee, setFee] = useState('0')

  async function load() {
    setLoading(true)
    const [secRes, txRes] = await Promise.all([
      supabase.from('securities').select('*').order('created_at', { ascending: true }),
      supabase.from('transactions').select('*').order('tanggal', { ascending: false }),
    ])
    if (secRes.error) setError(secRes.error.message)
    else {
      setSecurities(secRes.data as Security[])
      if (!securityId && secRes.data.length > 0) setSecurityId(secRes.data[0].id)
    }
    if (txRes.error) setError(txRes.error.message)
    else setTransactions(txRes.data as Transaction[])
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
    const hargaNum = Number(harga)
    const lotNum = Number(lot)
    const feeNum = Number(fee) || 0

    if (!securityId || !tickerUpper || !hargaNum || !lotNum) {
      setError('Isi semua field yang wajib (sekuritas, ticker, harga, lot).')
      return
    }
    if (!user) return

    setSubmitting(true)

    // Pastikan ticker ada di tabel stocks (referensi FK)
    const { error: stockErr } = await supabase
      .from('stocks')
      .upsert({ ticker: tickerUpper }, { onConflict: 'ticker', ignoreDuplicates: true })
    if (stockErr) {
      setError(stockErr.message)
      setSubmitting(false)
      return
    }

    const { error: txErr } = await supabase.from('transactions').insert({
      user_id: user.id,
      security_id: securityId,
      ticker: tickerUpper,
      tipe,
      tanggal,
      harga: hargaNum,
      lot: lotNum,
      fee: feeNum,
    })

    if (txErr) {
      setError(txErr.message)
      setSubmitting(false)
      return
    }

    setTicker('')
    setHarga('')
    setLot('')
    setFee('0')
    setSubmitting(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus transaksi ini?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  const securityName = (id: string) => securities.find((s) => s.id === id)?.nama ?? '-'

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Transaksi</h1>

      {securities.length === 0 && !loading ? (
        <p className="text-sm text-amber-600 mb-4">
          Belum ada akun sekuritas. Tambahkan dulu di halaman Sekuritas sebelum mencatat transaksi.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Sekuritas</label>
              <select
                value={securityId}
                onChange={(e) => setSecurityId(e.target.value)}
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
              <label className="block text-xs text-slate-600 mb-1">Tipe</label>
              <select
                value={tipe}
                onChange={(e) => setTipe(e.target.value as TransactionType)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              >
                <option value="buy">Beli</option>
                <option value="sell">Jual</option>
              </select>
            </div>
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
              <label className="block text-xs text-slate-600 mb-1">Tanggal</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Harga /lembar</label>
              <input
                type="number"
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Lot</label>
              <input
                type="number"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Fee (Rp)</label>
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2"
          >
            Catat Transaksi
          </button>
        </form>
      )}

      <h2 className="text-sm font-medium text-slate-700 mb-2">Riwayat Transaksi</h2>
      {loading ? (
        <p className="text-slate-600 text-sm">Memuat...</p>
      ) : transactions.length === 0 ? (
        <p className="text-slate-600 text-sm">Belum ada transaksi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-600 text-left">
              <tr>
                <th className="py-1 pr-2">Tanggal</th>
                <th className="py-1 pr-2">Ticker</th>
                <th className="py-1 pr-2">Tipe</th>
                <th className="py-1 pr-2">Harga</th>
                <th className="py-1 pr-2">Lot</th>
                <th className="py-1 pr-2">Sekuritas</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-slate-200">
                  <td className="py-1 pr-2">{tx.tanggal}</td>
                  <td className="py-1 pr-2">{tx.ticker}</td>
                  <td className={`py-1 pr-2 ${tx.tipe === 'buy' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.tipe === 'buy' ? 'Beli' : 'Jual'}
                  </td>
                  <td className="py-1 pr-2">{fmtNum(tx.harga)}</td>
                  <td className="py-1 pr-2">{tx.lot}</td>
                  <td className="py-1 pr-2">{securityName(tx.security_id)}</td>
                  <td className="py-1">
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="text-red-600 hover:text-red-700"
                    >
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
