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
