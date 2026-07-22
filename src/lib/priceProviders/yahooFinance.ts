import type { PriceProvider } from './types'

export const yahooFinanceProvider: PriceProvider = {
  async getPrices(tickers) {
    if (tickers.length === 0) return {}
    const res = await fetch(`/api/prices?tickers=${encodeURIComponent(tickers.join(','))}`)
    if (!res.ok) throw new Error(`Gagal mengambil harga: ${res.status}`)
    const json = await res.json()
    return json.prices
  },
}
