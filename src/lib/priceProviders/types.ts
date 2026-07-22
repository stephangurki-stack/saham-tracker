export interface PriceQuote {
  price: number
  prevClose: number | null
}

export interface PriceProvider {
  /** Returns a map of ticker -> harga terakhir & previous close (per share, Rupiah). */
  getPrices(tickers: string[]): Promise<Record<string, PriceQuote>>
}
