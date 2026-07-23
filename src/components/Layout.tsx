import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePrivacyMode } from '../hooks/usePrivacyMode'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/portfolio', label: 'Portofolio' },
  { to: '/transaksi', label: 'Transaksi' },
  { to: '/investasi', label: 'Investasi' },
  { to: '/dividen', label: 'Dividen' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/analisa', label: 'Analisa' },
  { to: '/sekuritas', label: 'Sekuritas' },
]

export default function Layout() {
  const { signOut } = useAuth()
  const { hidden, toggle } = usePrivacyMode()

  return (
    <div className="min-h-svh flex flex-col bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <span className="font-semibold">Portfolio Tracker IDX</span>
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            title={hidden ? 'Tampilkan angka' : 'Sensor angka'}
            className="text-slate-600 hover:text-slate-800"
          >
            {hidden ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4 10 8-.31 1.16-.9 2.32-1.68 3.38M6.61 6.61C4.6 8 3.2 9.9 2 12c1 4 5 8 10 8 1.36 0 2.65-.28 3.83-.79" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12c1-4 5-8 10-8s9 4 10 8c-1 4-5 8-10 8s-9-4-10-8z" />
                <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <button onClick={signOut} className="text-sm text-slate-600 hover:text-slate-800">
            Keluar
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-none min-w-[72px] text-center py-3 px-2 text-xs whitespace-nowrap ${
                isActive ? 'text-blue-600 font-medium' : 'text-slate-600'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
