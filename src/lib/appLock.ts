const PIN_KEY = 'app_lock_pin_v1'
const BIOMETRIC_KEY = 'app_lock_biometric_credential_v1'

interface StoredPin {
  salt: string
  hash: string
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bufToHex(bytes.buffer)
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bufToHex(digest)
}

export function hasPin(): boolean {
  return localStorage.getItem(PIN_KEY) !== null
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomHex(16)
  const hash = await hashPin(pin, salt)
  localStorage.setItem(PIN_KEY, JSON.stringify({ salt, hash } satisfies StoredPin))
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = localStorage.getItem(PIN_KEY)
  if (!raw) return false
  const stored = JSON.parse(raw) as StoredPin
  const hash = await hashPin(pin, stored.salt)
  return hash === stored.hash
}

export function clearPin(): void {
  localStorage.removeItem(PIN_KEY)
}

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function hasBiometric(): boolean {
  return localStorage.getItem(BIOMETRIC_KEY) !== null
}

/**
 * Registers a platform authenticator (fingerprint/Face ID) credential purely
 * as a local device-unlock gate — there is no server relying party to verify
 * the signature against, since the real authentication already happened via
 * Supabase. This only re-confirms device-owner presence before revealing an
 * already-valid session, like an OS lock screen layered on top of a login.
 */
export async function registerBiometric(userLabel: string): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userId = crypto.getRandomValues(new Uint8Array(16))

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Portfolio Tracker IDX' },
      user: { id: userId, name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('Gagal mendaftarkan biometrik')
  localStorage.setItem(BIOMETRIC_KEY, bufToHex(credential.rawId))
}

export async function verifyBiometric(): Promise<boolean> {
  const rawIdHex = localStorage.getItem(BIOMETRIC_KEY)
  if (!rawIdHex) return false

  const idBytes = new Uint8Array(rawIdHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: idBytes, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return assertion !== null
  } catch {
    return false
  }
}

export function clearBiometric(): void {
  localStorage.removeItem(BIOMETRIC_KEY)
}

export function isLockEnabled(): boolean {
  return hasPin() || hasBiometric()
}

export function clearLock(): void {
  clearPin()
  clearBiometric()
}
