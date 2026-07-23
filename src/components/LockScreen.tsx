import { useEffect, useState } from 'react'
import { hasBiometric, hasPin, isBiometricSupported, verifyBiometric, verifyPin } from '../lib/appLock'
import { useAuth } from '../hooks/useAuth'

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { signOut } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkingBiometric, setCheckingBiometric] = useState(false)
  const biometricEnabled = hasBiometric() && isBiometricSupported()

  async function tryBiometric() {
    setError(null)
    setCheckingBiometric(true)
    const ok = await verifyBiometric()
    setCheckingBiometric(false)
    if (ok) onUnlock()
    else setError('Verifikasi biometrik gagal atau dibatalkan. Coba lagi atau pakai PIN.')
  }

  // Prompt biometric immediately on load if it's set up, for a one-tap unlock.
  useEffect(() => {
    if (biometricEnabled) tryBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const ok = await verifyPin(pin)
    if (ok) onUnlock()
    else {
      setError('PIN salah. Coba lagi.')
      setPin('')
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl p-6 shadow-lg border border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900 mb-1">Terkunci</h1>
        <p className="text-sm text-slate-600 mb-6">Masukkan PIN untuk membuka Portfolio Tracker IDX</p>

        {biometricEnabled && (
          <button
            type="button"
            onClick={tryBiometric}
            disabled={checkingBiometric}
            className="w-full rounded-md bg-slate-100 border border-slate-300 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-medium py-2 mb-4"
          >
            {checkingBiometric ? 'Menunggu verifikasi...' : 'Buka dengan Sidik Jari / Face ID'}
          </button>
        )}

        {hasPin() && (
          <form onSubmit={handlePinSubmit}>
            <label className="block text-sm text-slate-700 mb-1">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              autoFocus={!biometricEnabled}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full mb-4 rounded-md bg-slate-100 border border-slate-300 px-3 py-2 text-slate-900 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••"
            />

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <button
              type="submit"
              disabled={pin.length < 4}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 mb-3"
            >
              Buka
            </button>
          </form>
        )}

        {!hasPin() && error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="button"
          onClick={() => signOut()}
          className="w-full text-sm text-slate-600 hover:text-slate-800"
        >
          Keluar dari akun ini
        </button>
      </div>
    </div>
  )
}
