import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

      if (result.error) {
        setError(result.error)
      } else if (mode === 'signup') {
        setInfo('Akun dibuat. Cek email untuk konfirmasi (jika diaktifkan), lalu login.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800"
      >
        <h1 className="text-xl font-semibold text-slate-100 mb-1">Portfolio Tracker IDX</h1>
        <p className="text-sm text-slate-400 mb-6">
          {mode === 'signin' ? 'Masuk ke akun Anda' : 'Buat akun baru'}
        </p>

        <label className="block text-sm text-slate-300 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="block text-sm text-slate-300 mb-1">Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {info && <p className="text-sm text-emerald-400 mb-4">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 mb-3"
        >
          {mode === 'signin' ? 'Masuk' : 'Daftar'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setInfo(null)
          }}
          className="w-full text-sm text-slate-400 hover:text-slate-200"
        >
          {mode === 'signin' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
        </button>
      </form>
    </div>
  )
}
