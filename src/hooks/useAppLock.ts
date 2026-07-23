import { useState } from 'react'
import { isLockEnabled } from '../lib/appLock'

/** Every fresh app load starts locked if the user has set up a PIN or biometric unlock. */
export function useAppLock() {
  const [locked, setLocked] = useState(() => isLockEnabled())

  return {
    locked,
    unlock: () => setLocked(false),
    lockNow: () => setLocked(isLockEnabled()),
  }
}
