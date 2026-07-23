import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { exportAllDataToExcel } from '../lib/exportData'
import type { Security } from '../lib/types'

export default function Securities() {
  const { user } = useAuth()
  const [securities, setSecurities] = useState<Security[]>([])
  const [nama, setNama] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setExportError(null)
    try {
      await exportAllDataToExcel()
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Gagal membuat file backup.')
    }
    setExporting(false)
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('securities')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setSecurities(data as Security[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!nama.trim() || !user) return
    const { error } = await supabase.from('securities').insert({ nama: nama.trim(), user_id: user.id })
    if (error) {
      setError(error.message)
      return
    }
    setNama('')
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus akun sekuritas ini? Transaksi terkait juga akan terhapus.')) return
    const { error } = await supabase.from('securities').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-lg font-semibold mb-4">Akun Sekuritas</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Nama sekuritas (mis. Mirae, Stockbit)"
          className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2">
          Tambah
        </button>
      </form>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {loading ? (
        <p className="text-slate-400 text-sm">Memuat...</p>
      ) : securities.length === 0 ? (
        <p className="text-slate-400 text-sm">Belum ada akun sekuritas. Tambahkan di atas.</p>
      ) : (
        <ul className="space-y-2">
          {securities.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-md px-3 py-2"
            >
              <span>{s.nama}</span>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-300 mb-1">Backup Data</p>
        <p className="text-xs text-slate-500 mb-3">
          Unduh seluruh data Anda (sekuritas, transaksi, investasi, dividen, watchlist, analisa) sebagai satu file
          Excel dengan satu sheet per jenis data.
        </p>
        {exportError && <p className="text-sm text-red-400 mb-2">{exportError}</p>}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-2"
        >
          {exporting ? 'Menyiapkan file...' : 'Export ke Excel'}
        </button>
      </div>
    </div>
  )
}
