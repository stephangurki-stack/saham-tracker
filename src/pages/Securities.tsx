import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { exportAllDataToExcel } from '../lib/exportData'
import {
  clearBiometric,
  clearPin,
  hasBiometric,
  hasPin,
  isBiometricAvailable,
  isBiometricSupported,
  registerBiometric,
  setPin,
} from '../lib/appLock'
import type { Security } from '../lib/types'

export default function Securities() {
  const { user } = useAuth()
  const [securities, setSecurities] = useState<Security[]>([])
  const [nama, setNama] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [pinEnabled, setPinEnabled] = useState(hasPin())
  const [biometricEnabled, setBiometricEnabled] = useState(hasBiometric())
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [lockError, setLockError] = useState<string | null>(null)
  const [lockSuccess, setLockSuccess] = useState<string | null>(null)
  const [savingPin, setSavingPin] = useState(false)
  const [registeringBiometric, setRegisteringBiometric] = useState(false)

  useEffect(() => {
    if (isBiometricSupported()) isBiometricAvailable().then(setBiometricAvailable)
  }, [])

  async function handleSetPin(e: FormEvent) {
    e.preventDefault()
    setLockError(null)
    setLockSuccess(null)
    if (pinInput.length < 4) {
      setLockError('PIN minimal 4 digit.')
      return
    }
    if (pinInput !== pinConfirm) {
      setLockError('Konfirmasi PIN tidak cocok.')
      return
    }
    setSavingPin(true)
    await setPin(pinInput)
    setPinEnabled(true)
    setPinInput('')
    setPinConfirm('')
    setLockSuccess('PIN berhasil disimpan.')
    setSavingPin(false)
  }

  function handleRemovePin() {
    if (!confirm('Hapus PIN? Anda tidak akan diminta PIN lagi saat membuka aplikasi.')) return
    clearPin()
    setPinEnabled(false)
    setLockSuccess(null)
  }

  async function handleRegisterBiometric() {
    setLockError(null)
    setLockSuccess(null)
    setRegisteringBiometric(true)
    try {
      await registerBiometric(user?.email ?? 'user')
      setBiometricEnabled(true)
      setLockSuccess('Sidik jari / Face ID berhasil didaftarkan.')
    } catch (e) {
      setLockError(e instanceof Error ? e.message : 'Gagal mendaftarkan biometrik. Pastikan HP mendukung dan sudah setup sidik jari/Face ID.')
    }
    setRegisteringBiometric(false)
  }

  function handleRemoveBiometric() {
    clearBiometric()
    setBiometricEnabled(false)
    setLockSuccess(null)
  }

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
          className="flex-1 rounded-md bg-slate-100 border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="rounded-md bg-blue-600 hover:bg-blue-500 text-white px-4 py-2">
          Tambah
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p className="text-slate-600 text-sm">Memuat...</p>
      ) : securities.length === 0 ? (
        <p className="text-slate-600 text-sm">Belum ada akun sekuritas. Tambahkan di atas.</p>
      ) : (
        <ul className="space-y-2">
          {securities.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-2"
            >
              <span>{s.nama}</span>
              <button
                onClick={() => handleDelete(s.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 bg-white border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 mb-1">Kunci Aplikasi</p>
        <p className="text-xs text-slate-400 mb-3">
          Setelah login, buka aplikasi berikutnya cukup dengan PIN atau sidik jari/Face ID — tidak perlu ketik email
          dan password lagi. Tersimpan hanya di HP ini.
        </p>

        {lockError && <p className="text-sm text-red-600 mb-3">{lockError}</p>}
        {lockSuccess && <p className="text-sm text-emerald-600 mb-3">{lockSuccess}</p>}

        {biometricAvailable && (
          <div className="mb-4 pb-4 border-b border-slate-200">
            <p className="text-xs text-slate-600 mb-2">Sidik Jari / Face ID</p>
            {biometricEnabled ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-emerald-600">Aktif</span>
                <button onClick={handleRemoveBiometric} className="text-sm text-red-600 hover:text-red-700">
                  Nonaktifkan
                </button>
              </div>
            ) : (
              <button
                onClick={handleRegisterBiometric}
                disabled={registeringBiometric}
                className="rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-50 text-slate-800 text-sm px-4 py-2"
              >
                {registeringBiometric ? 'Menunggu verifikasi...' : 'Daftarkan Sidik Jari / Face ID'}
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-slate-600 mb-2">PIN</p>
        {pinEnabled ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-600">Aktif</span>
            <button onClick={handleRemovePin} className="text-sm text-red-600 hover:text-red-700">
              Hapus PIN
            </button>
          </div>
        ) : (
          <form onSubmit={handleSetPin} className="flex flex-col gap-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN baru (4-6 digit)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="rounded-md bg-slate-100 border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="Ulangi PIN"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="rounded-md bg-slate-100 border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={savingPin}
              className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2"
            >
              Simpan PIN
            </button>
          </form>
        )}
      </div>

      <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
        <p className="text-sm font-medium text-slate-700 mb-1">Backup Data</p>
        <p className="text-xs text-slate-400 mb-3">
          Unduh seluruh data Anda (sekuritas, transaksi, investasi, dividen, watchlist, analisa) sebagai satu file
          Excel dengan satu sheet per jenis data.
        </p>
        {exportError && <p className="text-sm text-red-600 mb-2">{exportError}</p>}
        <button
          onClick={handleExport}
          disabled={exporting}
          className="rounded-md bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 text-sm px-4 py-2"
        >
          {exporting ? 'Menyiapkan file...' : 'Export ke Excel'}
        </button>
      </div>
    </div>
  )
}
