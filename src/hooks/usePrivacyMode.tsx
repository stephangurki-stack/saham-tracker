import { createContext, useContext, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'privacy_mode_hidden'

interface PrivacyContextValue {
  hidden: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null)

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')

  function toggle() {
    setHidden((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>
}

export function usePrivacyMode() {
  const ctx = useContext(PrivacyContext)
  if (!ctx) throw new Error('usePrivacyMode must be used within PrivacyProvider')
  return ctx
}
