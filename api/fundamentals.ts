export const config = { runtime: 'edge' }

const UA = 'Mozilla/5.0'

interface Fundamentals {
  eps: number | null
  bvps: number | null
}

/**
 * Yahoo Finance's quoteSummary endpoint has real EPS/BVPS data, but unlike
 * the chart endpoint (used for prices) it's gated behind an undocumented
 * crumb token tied to a session cookie. This is more fragile than the price
 * proxy — Yahoo can change or block it without notice — so callers must
 * treat a failure here as "unavailable" and fall back to manual entry,
 * never as a hard error.
 */
async function fetchFundamentals(ticker: string): Promise<Fundamentals | null> {
  const symbol = `${ticker}.JK`

  const cookieRes = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } })
  const setCookie = cookieRes.headers.get('set-cookie')
  if (!setCookie) return null
  const cookie = setCookie.split(';')[0]

  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
  })
  if (!crumbRes.ok) return null
  const crumb = await crumbRes.text()
  if (!crumb) return null

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics&crumb=${encodeURIComponent(crumb)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } })
  if (!res.ok) return null

  const json = await res.json()
  const stats = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics
  const eps = stats?.trailingEps?.raw
  const bvps = stats?.bookValue?.raw

  if (typeof eps !== 'number' && typeof bvps !== 'number') return null
  return {
    eps: typeof eps === 'number' ? eps : null,
    bvps: typeof bvps === 'number' ? bvps : null,
  }
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const ticker = url.searchParams.get('ticker')
  if (!ticker) {
    return Response.json({ error: 'Query param "ticker" wajib diisi' }, { status: 400 })
  }

  try {
    const data = await fetchFundamentals(ticker.trim().toUpperCase())
    if (!data) {
      return Response.json({ error: 'Data fundamental tidak tersedia untuk ticker ini' }, { status: 404 })
    }
    return Response.json(data)
  } catch {
    return Response.json({ error: 'Gagal mengambil data fundamental' }, { status: 502 })
  }
}
