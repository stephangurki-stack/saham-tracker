import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { yahooFinanceProvider } from '../lib/priceProviders/yahooFinance'
import type { PriceQuote } from '../lib/priceProviders/types'
import { aggregateHoldingsByTicker, computeCashBalance, computeHoldingsBySecurity } from '../lib/portfolio'
import type { CashFlow, Dividend, Holding, Security, Transaction } from '../lib/types'

export function usePortfolioData() {
  const [securities, setSecurities] = useState<Security[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([])
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [secRes, txRes, cfRes, divRes] = await Promise.all([
      supabase.from('securities').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('cash_flows').select('*'),
      supabase.from('dividends').select('*'),
    ])

    if (secRes.error) setError(secRes.error.message)
    if (txRes.error) setError(txRes.error.message)
    if (cfRes.error) setError(cfRes.error.message)
    if (divRes.error) setError(divRes.error.message)

    const secData = (secRes.data ?? []) as Security[]
    const txData = (txRes.data ?? []) as Transaction[]
    setSecurities(secData)
    setTransactions(txData)
    setCashFlows((cfRes.data ?? []) as CashFlow[])
    setDividends((divRes.data ?? []) as Dividend[])

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
  const cashBalance = computeCashBalance(transactions, cashFlows, dividends)
  const cashBalanceBySecurity: Record<string, number> = Object.fromEntries(
    securities.map((s) => [
      s.id,
      computeCashBalance(
        transactions.filter((t) => t.security_id === s.id),
        cashFlows.filter((c) => c.security_id === s.id),
        dividends.filter((d) => d.security_id === s.id)
      ),
    ])
  )

  return {
    securities,
    transactions,
    cashFlows,
    dividends,
    holdingsBySecurity,
    holdingsGabungan,
    prices,
    quotes,
    cashBalance,
    cashBalanceBySecurity,
    loading,
    error,
    refresh: load,
  }
}
