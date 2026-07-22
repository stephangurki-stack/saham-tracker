import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Transactions from './pages/Transactions'
import Securities from './pages/Securities'
import Investasi from './pages/Investasi'
import Dividen from './pages/Dividen'
import Watchlist from './pages/Watchlist'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-slate-950 text-slate-400">
        Memuat...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-slate-950 text-slate-400">
        Memuat...
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return <Login />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="transaksi" element={<Transactions />} />
        <Route path="investasi" element={<Investasi />} />
        <Route path="dividen" element={<Dividen />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="sekuritas" element={<Securities />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
