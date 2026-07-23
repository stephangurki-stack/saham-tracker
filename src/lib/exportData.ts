import { supabase } from './supabase'

const TABLES = [
  'securities',
  'transactions',
  'cash_flows',
  'dividends',
  'dividend_targets',
  'watchlist',
  'stock_analyses',
  'portfolio_snapshots',
] as const

/** Fetches every user table and writes one sheet per table into a downloaded .xlsx file. */
export async function exportAllDataToExcel(): Promise<void> {
  // Lazy-loaded: exceljs is large (~1.8MB) and export is an infrequent action,
  // so it shouldn't bloat the initial bundle every user downloads on every visit.
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`Gagal mengambil data ${table}: ${error.message}`)

    const sheet = workbook.addWorksheet(table)
    const rows = data ?? []

    if (rows.length === 0) {
      sheet.addRow(['(tidak ada data)'])
      continue
    }

    const columns = Object.keys(rows[0])
    sheet.columns = columns.map((key) => ({ header: key, key, width: 18 }))
    for (const row of rows) {
      const flatRow: Record<string, unknown> = {}
      for (const key of columns) {
        const value = row[key]
        flatRow[key] = typeof value === 'object' && value !== null ? JSON.stringify(value) : value
      }
      sheet.addRow(flatRow)
    }
    sheet.getRow(1).font = { bold: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `portfolio-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
