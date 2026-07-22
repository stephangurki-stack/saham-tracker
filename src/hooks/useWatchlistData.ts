import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { yahooFinanceProvider } from '../lib/priceProviders/yahooFinance'
import { marginOfSafety } from '../lib/valuation'
import type { WatchlistRow } from '../lib/types'

export interface WatchlistWithMos {
  row: WatchlistRow
  price: number | null
  mos: number | null
}

export function useWatchlistData() {
  const [rows, setRows] = useState<WatchlistRow[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .order('tanggal_update', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const watchlistRows = data as WatchlistRow[]
    setRows(watchlistRows)

    const tickers = watchlistRows.map((r) => r.ticker)
    if (tickers.length > 0) {
      try {
        const quotes = await yahooFinanceProvider.getPrices(tickers)
        setPrices(Object.fromEntries(Object.entries(quotes).map(([tk, q]) => [tk, q.price])))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mengambil harga')
      }
    } else {
      setPrices({})
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const withMos: WatchlistWithMos[] = rows.map((row) => {
    const price = prices[row.ticker] ?? null
    const mos = row.nilai_wajar && price ? marginOfSafety(row.nilai_wajar, price) : null
    return { row, price, mos }
  })

  return { rows, prices, withMos, loading, error, refresh: load }
}
