import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/portfolio', label: 'Portofolio' },
  { to: '/transaksi', label: 'Transaksi' },
  { to: '/investasi', label: 'Investasi' },
  { to: '/dividen', label: 'Dividen' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/sekuritas', label: 'Sekuritas' },
]

export default function Layout() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-svh flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <span className="font-semibold">Portfolio Tracker IDX</span>
        <button onClick={signOut} className="text-sm text-slate-400 hover:text-slate-200">
          Keluar
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 flex overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-none min-w-[72px] text-center py-3 px-2 text-xs whitespace-nowrap ${
                isActive ? 'text-blue-400 font-medium' : 'text-slate-400'
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
