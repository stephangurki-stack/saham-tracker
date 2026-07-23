export type TransactionType = 'buy' | 'sell'

export interface Security {
  id: string
  user_id: string
  nama: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  security_id: string
  ticker: string
  tipe: TransactionType
  tanggal: string
  harga: number
  lot: number
  fee: number
  created_at: string
}

export interface PriceQuote {
  ticker: string
  harga_terakhir: number
  timestamp: string
}

export interface Holding {
  ticker: string
  security_id: string
  lot: number
  avgBuyPrice: number
  costBasis: number
  realizedGain: number
}

export type CashFlowType = 'deposit' | 'withdraw'

export interface CashFlow {
  id: string
  user_id: string
  security_id: string
  tipe: CashFlowType
  tanggal: string
  jumlah: number
  created_at: string
}

export interface Dividend {
  id: string
  user_id: string
  security_id: string
  ticker: string
  cum_date: string | null
  ex_date: string | null
  tanggal_bayar: string
  jumlah_per_lembar: number
  total: number
  created_at: string
}

export interface WatchlistRow {
  id: string
  user_id: string
  ticker: string
  metode_valuasi: import('./valuation').ValuationMethod
  asumsi: Record<string, unknown>
  nilai_wajar: number | null
  tanggal_update: string
}

export interface DividendTarget {
  id: string
  user_id: string
  tahun: number
  target: number
  created_at: string
  updated_at: string
}

export type PeriodeTipe = 'tahunan' | 'triwulan'

export interface StockAnalysis {
  id: string
  user_id: string
  ticker: string
  periode_tipe: PeriodeTipe
  tahun: number
  triwulan: number | null
  judul: string | null
  catatan: string
  created_at: string
  updated_at: string
}
