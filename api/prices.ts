import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 menit

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.VITE_SUPABASE_ANON_KEY as string
)

interface YahooQuote {
  price: number | null
  prevClose: number | null
}

async function fetchYahooQuote(ticker: string): Promise<YahooQuote> {
  const symbol = `${ticker}.JK`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return { price: null, prevClose: null }
  const json = await res.json()
  const meta = json?.chart?.result?.[0]?.meta
  return {
    price: typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null,
    prevClose: typeof meta?.previousClose === 'number' ? meta.previousClose : null,
  }
}

interface PriceEntry {
  price: number
  prevClose: number | null
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const tickersParam = url.searchParams.get('tickers')

  if (!tickersParam) {
    return Response.json({ error: 'Query param "tickers" wajib diisi, mis. ?tickers=BBCA,TOTO' }, { status: 400 })
  }

  const tickers = [...new Set(tickersParam.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean))]
  const now = Date.now()
  const result: Record<string, PriceEntry> = {}

  const { data: cached } = await supabase
    .from('price_cache')
    .select('ticker, harga_terakhir, prev_close, timestamp')
    .in('ticker', tickers)

  const cacheMap = new Map((cached ?? []).map((c) => [c.ticker, c]))
  const staleTickers: string[] = []

  for (const ticker of tickers) {
    const entry = cacheMap.get(ticker)
    if (entry && now - new Date(entry.timestamp).getTime() < CACHE_TTL_MS) {
      result[ticker] = { price: entry.harga_terakhir, prevClose: entry.prev_close }
    } else {
      staleTickers.push(ticker)
    }
  }

  if (staleTickers.length > 0) {
    const fetched = await Promise.all(
      staleTickers.map(async (ticker) => ({ ticker, quote: await fetchYahooQuote(ticker) }))
    )

    const upserts = fetched
      .filter((f) => f.quote.price !== null)
      .map((f) => ({
        ticker: f.ticker,
        harga_terakhir: f.quote.price,
        prev_close: f.quote.prevClose,
        timestamp: new Date().toISOString(),
      }))

    if (upserts.length > 0) {
      await supabase.from('price_cache').upsert(upserts, { onConflict: 'ticker' })
    }

    for (const f of fetched) {
      if (f.quote.price !== null) {
        result[f.ticker] = { price: f.quote.price, prevClose: f.quote.prevClose }
      } else {
        const stale = cacheMap.get(f.ticker)
        if (stale) result[f.ticker] = { price: stale.harga_terakhir, prevClose: stale.prev_close }
      }
    }
  }

  return Response.json({ prices: result, timestamp: new Date().toISOString() })
}
