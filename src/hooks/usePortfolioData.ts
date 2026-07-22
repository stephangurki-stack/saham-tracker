import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { yahooFinanceProvider } from '../lib/priceProviders/yahooFinance'
import type { PriceQuote } from '../lib/priceProviders/types'
import { aggregateHoldingsByTicker, computeHoldingsBySecurity } from '../lib/portfolio'
import type { Holding, Security, Transaction } from '../lib/types'

export function usePortfolioData() {
  const [securities, setSecurities] = useState<Security[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [secRes, txRes] = await Promise.all([
      supabase.from('securities').select('*'),
      supabase.from('transactions').select('*'),
    ])

    if (secRes.error) setError(secRes.error.message)
    if (txRes.error) setError(txRes.error.message)

    const secData = (secRes.data ?? []) as Security[]
    const txData = (txRes.data ?? []) as Transaction[]
    setSecurities(secData)
    setTransactions(txData)

    const holdingsBySecurity = computeHoldingsBySecurity(txData)
    const tickers = [...new Set(holdingsBySecurity.filter((h) => h.lot > 0).map((h) => h.ticker))]

    if (tickers.length > 0) {
      try {
        const fetchedQuotes = await yahooFinanceProvider.getPrices(tickers)
        setQuotes(fetchedQuotes)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mengambil harga saham')
      }
    } else {
      setQuotes({})
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const holdingsBySecurity: Holding[] = computeHoldingsBySecurity(transactions)
  const holdingsGabungan: Holding[] = aggregateHoldingsByTicker(holdingsBySecurity)
  const prices: Record<string, number> = Object.fromEntries(
    Object.entries(quotes).map(([ticker, q]) => [ticker, q.price])
  )

  return {
    securities,
    transactions,
    holdingsBySecurity,
    holdingsGabungan,
    prices,
    quotes,
    loading,
    error,
    refresh: load,
  }
}
