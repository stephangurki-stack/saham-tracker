import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePortfolioData } from '../hooks/usePortfolioData'
import { useWatchlistData } from '../hooks/useWatchlistData'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { marketValue } from '../lib/portfolio'
import {
  evaluateBuy,
  evaluateSell,
  type BuyResult,
  type Lamp,
  type PathStep,
  type SellResult,
} from '../lib/policy'
import type { StockThesis, StockType } from '../lib/types'

const LAMP_KEY = 'lampu_ekonomi'
const lampLabels: Record<Lamp, string> = {
  hijau: 'Hijau (0–1 waspada)',
  kuning: 'Kuning (2–3 waspada)',
  merah: 'Merah (≥4 waspada)',
}
const jenisLabels: Record<StockType, string> = {
  Q: 'Q — Bertumbuh',
  V: 'V — Murah biasa',
  S: 'S — Situasi khusus',
}

const pct = (n: number, d = 1) => (n * 100).toFixed(d).replace('.', ',') + '%'

function badgeClass(decision: string): string {
  if (['JUAL SEMUA SEGERA', 'JUAL'].includes(decision)) return 'bg-red-600 text-white'
  if (['JUAL SEBAGIAN', 'KURANGI', 'TUKAR', 'EVALUASI'].includes(decision)) return 'bg-amber-500 text-white'
  if (['TAMBAH', 'BELI TAHAP 1'].includes(decision)) return 'bg-emerald-600 text-white'
  if (decision === 'DAFTAR BELANJA') return 'bg-blue-600 text-white'
  if (['LEWATI', 'TIDAK MEMBELI'].includes(decision)) return 'bg-slate-700 text-white'
  if (decision === 'TAHAN') return 'bg-slate-200 text-slate-800'
  return 'bg-slate-100 text-slate-600 border border-slate-300'
}

function triToStr(v: boolean | null): string {
  return v === null ? '' : v ? 'ya' : 'tidak'
}
function strToTri(s: string): boolean | null {
  return s === '' ? null : s === 'ya'
}

interface FormState {
  jenis: StockType
  isBank: boolean
  isMsci: boolean
  tanggalInitiate: string
  sumber: string
  ringkasan: string
  alasanBeli: string
  pematah: string
  nilaiWajar3th: string
  dividendYield: string
  tandaBahaya: boolean
  tesisPatah: boolean
  penggantiLebihBaik: boolean
  saringan: string
  fscore: string
  roeOk: string
  checklistLengkap: boolean
}

function toForm(t: StockThesis | undefined): FormState {
  return {
    jenis: t?.jenis ?? 'V',
    isBank: t?.is_bank ?? false,
    isMsci: t?.is_msci ?? false,
    tanggalInitiate: t?.tanggal_initiate ?? '',
    sumber: t?.sumber ?? '',
    ringkasan: t?.ringkasan ?? '',
    alasanBeli: t?.alasan_beli ?? '',
    pematah: (t?.pematah_tesis ?? []).join('\n'),
    nilaiWajar3th: t?.nilai_wajar_3th != null ? String(t.nilai_wajar_3th) : '',
    dividendYield: t?.dividend_yield_pct != null ? String(t.dividend_yield_pct) : '',
    tandaBahaya: t?.tanda_bahaya ?? false,
    tesisPatah: t?.tesis_patah ?? false,
    penggantiLebihBaik: t?.pengganti_lebih_baik ?? false,
    saringan: triToStr(t?.saringan_lolos ?? null),
    fscore: t?.fscore != null ? String(t.fscore) : '',
    roeOk: triToStr(t?.roe_ok ?? null),
    checklistLengkap: t?.checklist_lengkap ?? false,
  }
}

const inputCls = 'w-full rounded-md bg-slate-100 border border-slate-300 px-2 py-2 text-sm text-slate-900'
const labelCls = 'block text-xs text-slate-600 mb-1'

function ThesisForm({
  ticker,
  initial,
  held,
  onSaved,
  onCancel,
}: {
  ticker: string
  initial: StockThesis | undefined
  held: boolean
  onSaved: () => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [f, setF] = useState<FormState>(toForm(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    const fv3 = f.nilaiWajar3th === '' ? null : Number(f.nilaiWajar3th)
    const dy = f.dividendYield === '' ? null : Number(f.dividendYield)
    const fs = f.fscore === '' ? null : Number(f.fscore)
    if ((fv3 !== null && !(fv3 > 0)) || (dy !== null && dy < 0) || (fs !== null && (fs < 0 || fs > 9 || !Number.isInteger(fs)))) {
      setError('Cek angka: nilai wajar 3 th harus >0, dividend yield ≥0, F-score bilangan bulat 0–9.')
      return
    }
    setSaving(true)
    const { error: stockErr } = await supabase
      .from('stocks')
      .upsert({ ticker }, { onConflict: 'ticker', ignoreDuplicates: true })
    if (stockErr) {
      setError(stockErr.message)
      setSaving(false)
      return
    }
    const { error: err } = await supabase.from('stock_thesis').upsert(
      {
        user_id: user.id,
        ticker,
        jenis: f.jenis,
        is_bank: f.isBank,
        is_msci: f.isMsci,
        tanggal_initiate: f.tanggalInitiate || null,
        sumber: f.sumber.trim() || null,
        ringkasan: f.ringkasan.trim(),
        alasan_beli: f.alasanBeli.trim(),
        pematah_tesis: f.pematah
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        nilai_wajar_3th: fv3,
        dividend_yield_pct: dy,
        tanda_bahaya: f.tandaBahaya,
        tesis_patah: f.tesisPatah,
        pengganti_lebih_baik: f.penggantiLebihBaik,
        saringan_lolos: strToTri(f.saringan),
        fscore: fs,
        roe_ok: strToTri(f.roeOk),
        checklist_lengkap: f.checklistLengkap,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,ticker' }
    )
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const check = (label: string, key: 'isBank' | 'isMsci' | 'tandaBahaya' | 'tesisPatah' | 'penggantiLebihBaik' | 'checklistLengkap') => (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={f[key]} onChange={(e) => set(key, e.target.checked)} className="mt-1" />
      <span>{label}</span>
    </label>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-slate-200 pt-3 mt-3">
      <p className="text-sm font-medium text-slate-700">Thesis {ticker}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Jenis saham</label>
          <select value={f.jenis} onChange={(e) => set('jenis', e.target.value as StockType)} className={inputCls}>
            {(Object.keys(jenisLabels) as StockType[]).map((j) => (
              <option key={j} value={j}>
                {jenisLabels[j]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Tanggal initiate report</label>
          <input type="date" value={f.tanggalInitiate} onChange={(e) => set('tanggalInitiate', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex gap-4">
        {check('Bank', 'isBank')}
        {check('Saham indeks MSCI', 'isMsci')}
      </div>
      <div>
        <label className={labelCls}>Sumber report</label>
        <input value={f.sumber} onChange={(e) => set('sumber', e.target.value)} placeholder="MERK_Initiation_Report_2026-08-25.docx" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Ringkasan thesis (cerita dua menit)</label>
        <textarea rows={3} value={f.ringkasan} onChange={(e) => set('ringkasan', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Alasan membeli</label>
        <textarea rows={3} value={f.alasanBeli} onChange={(e) => set('alasanBeli', e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Syarat batal / pematah tesis (satu per baris, 2–4 butir)</label>
        <textarea rows={4} value={f.pematah} onChange={(e) => set('pematah', e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Nilai wajar 3 tahun lagi (Rp)</label>
          <input type="number" value={f.nilaiWajar3th} onChange={(e) => set('nilaiWajar3th', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Dividend yield (%/tahun)</label>
          <input type="number" step="0.1" value={f.dividendYield} onChange={(e) => set('dividendYield', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
        <p className="text-xs font-medium text-slate-600">Untuk keputusan jual / tahan</p>
        {check('Tanda bahaya serius (PKPU, gagal bayar, opini bukan WTP, auditor diganti mendadak, papan pemantauan, indikasi manipulasi)', 'tandaBahaya')}
        {check('Tesis patah: salah satu syarat batal sudah terjadi', 'tesisPatah')}
        {check('Ada pengganti yang jelas lebih baik (sudah diriset sampai CALK)', 'penggantiLebihBaik')}
      </div>

      {!held && (
        <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-3">
          <p className="text-xs font-medium text-slate-600">Untuk keputusan beli</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Saringan wajib</label>
              <select value={f.saringan} onChange={(e) => set('saringan', e.target.value)} className={inputCls}>
                <option value="">Belum dicek</option>
                <option value="ya">Lolos</option>
                <option value="tidak">Gagal</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>F-score (V)</label>
              <input type="number" min={0} max={9} value={f.fscore} onChange={(e) => set('fscore', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>ROE ≥15% 5 th (Q)</label>
              <select value={f.roeOk} onChange={(e) => set('roeOk', e.target.value)} className={inputCls}>
                <option value="">Belum dicek</option>
                <option value="ya">Ya</option>
                <option value="tidak">Tidak</option>
              </select>
            </div>
          </div>
          {check('Checklist 10 butir sebelum membeli sudah lengkap', 'checklistLengkap')}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2">
          Simpan thesis
        </button>
        <button type="button" onClick={onCancel} className="rounded-md bg-slate-100 text-slate-700 px-4 py-2 text-sm">
          Batal
        </button>
      </div>
    </form>
  )
}

function PathList({ path, mode }: { path: PathStep[]; mode: 'sell' | 'buy' }) {
  return (
    <ol className="space-y-1.5 text-xs">
      {path.map((s) => {
        const state = s.yes === null ? 'unknown' : s.yes ? 'hit' : 'pass'
        const tag =
          state === 'unknown'
            ? { text: '?', cls: 'bg-slate-200 text-slate-600' }
            : mode === 'sell'
              ? state === 'hit'
                ? { text: 'YA', cls: 'bg-red-100 text-red-700' }
                : { text: 'TIDAK', cls: 'bg-emerald-100 text-emerald-700' }
              : state === 'hit'
                ? { text: 'TIDAK', cls: 'bg-red-100 text-red-700' }
                : { text: 'LOLOS', cls: 'bg-emerald-100 text-emerald-700' }
        return (
          <li key={s.no} className="flex gap-2">
            <span className={`shrink-0 w-12 text-center rounded px-1 py-0.5 font-medium ${tag.cls}`}>{tag.text}</span>
            <span className="text-slate-600">
              <span className="text-slate-800">
                {s.no}. {s.question}
              </span>
              <br />
              {s.detail}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface Row {
  ticker: string
  held: boolean
  price: number | null
  fairValue: number | null
  weight: number
  firstBuyDate: string | null
  thesis: StockThesis | undefined
  sell: SellResult | null
  buy: BuyResult | null
}

export default function Thesis() {
  const { holdingsGabungan, prices, cashBalance, loading: loadingPortfolio } = usePortfolioData()
  const { rows: watchlistRows, prices: wlPrices, loading: loadingWl } = useWatchlistData()
  const { hidden } = usePrivacyMode()
  const fmtNum = (n: number) => (hidden ? '••••' : Math.round(n).toLocaleString('id-ID'))
  const [theses, setTheses] = useState<StockThesis[]>([])
  const [loadingThesis, setLoadingThesis] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'portofolio' | 'watchlist'>('portofolio')
  const [openTicker, setOpenTicker] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [lamp, setLamp] = useState<Lamp>(() => {
    try {
      const v = localStorage.getItem(LAMP_KEY)
      return v === 'kuning' || v === 'merah' ? v : 'hijau'
    } catch {
      return 'hijau'
    }
  })

  async function loadTheses() {
    const { data, error: err } = await supabase.from('stock_thesis').select('*')
    if (err) setError(err.message)
    else setTheses(data as StockThesis[])
    setLoadingThesis(false)
  }
  useEffect(() => {
    loadTheses()
  }, [])

  function changeLamp(l: Lamp) {
    setLamp(l)
    try {
      localStorage.setItem(LAMP_KEY, l)
    } catch {
      // ignore: lamp just won't persist across reloads
    }
  }

  async function markChecked(t: StockThesis, price: number) {
    const { error: err } = await supabase
      .from('stock_thesis')
      .update({
        harga_pemeriksaan_terakhir: price,
        tanggal_pemeriksaan_terakhir: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', t.id)
    if (err) setError(err.message)
    else loadTheses()
  }

  if (loadingPortfolio || loadingWl || loadingThesis) return <div className="p-4 text-slate-600 text-sm">Memuat...</div>

  const held = holdingsGabungan.filter((h) => h.lot > 0)
  const stockValue = held.reduce((s, h) => s + marketValue(h, prices[h.ticker] ?? 0), 0)
  const totalValue = stockValue + cashBalance
  const fairByTicker = new Map(watchlistRows.filter((r) => r.nilai_wajar).map((r) => [r.ticker, r.nilai_wajar as number]))
  const thesisByTicker = new Map(theses.map((t) => [t.ticker, t]))

  const buildRow = (ticker: string, isHeld: boolean): Row => {
    const h = held.find((x) => x.ticker === ticker)
    const price = (isHeld ? prices[ticker] : wlPrices[ticker]) ?? wlPrices[ticker] ?? prices[ticker] ?? null
    const fairValue = fairByTicker.get(ticker) ?? null
    const t = thesisByTicker.get(ticker)
    const weight = h && totalValue > 0 ? marketValue(h, price ?? 0) / totalValue : 0
    let sell: SellResult | null = null
    let buy: BuyResult | null = null
    if (isHeld && t && price) {
      sell = evaluateSell({
        jenis: t.jenis,
        isBank: t.is_bank,
        isMsci: t.is_msci,
        price,
        fairValue,
        fairValue3y: t.nilai_wajar_3th,
        dividendYieldPct: t.dividend_yield_pct,
        weight,
        firstBuyDate: h?.firstBuyDate ?? null,
        lastCheckPrice: t.harga_pemeriksaan_terakhir,
        tandaBahaya: t.tanda_bahaya,
        tesisPatah: t.tesis_patah,
        penggantiLebihBaik: t.pengganti_lebih_baik,
        lamp,
      })
    }
    if (!isHeld) {
      buy = evaluateBuy({
        jenis: t?.jenis ?? 'V',
        isBank: t?.is_bank ?? false,
        isMsci: t?.is_msci ?? false,
        hasThesis: !!t,
        ringkasan: t?.ringkasan ?? '',
        price,
        fairValue,
        fairValue3y: t?.nilai_wajar_3th ?? null,
        dividendYieldPct: t?.dividend_yield_pct ?? null,
        saringanLolos: t?.saringan_lolos ?? null,
        fscore: t?.fscore ?? null,
        roeOk: t?.roe_ok ?? null,
        checklistLengkap: t?.checklist_lengkap ?? false,
        lamp,
      })
    }
    return { ticker, held: isHeld, price, fairValue, weight, firstBuyDate: h?.firstBuyDate ?? null, thesis: t, sell, buy }
  }

  const heldTickers = new Set(held.map((h) => h.ticker))
  const portfolioRows = held.map((h) => buildRow(h.ticker, true)).sort((a, b) => a.ticker.localeCompare(b.ticker))
  const watchRows = watchlistRows
    .filter((r) => !heldTickers.has(r.ticker))
    .map((r) => buildRow(r.ticker, false))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
  const rows = tab === 'portofolio' ? portfolioRows : watchRows

  const actionCount = portfolioRows.filter(
    (r) => r.sell && !['TAHAN', 'DATA KURANG'].includes(r.sell.decision)
  ).length

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Thesis &amp; Kebijakan</h1>
        <p className="text-xs text-slate-400 mt-1">
          Keputusan dihitung dari Kebijakan Jual–Tahan dan Kebijakan Membeli. Panduan pribadi, bukan nasihat investasi
          berlisensi.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <label className={labelCls}>Lampu kondisi ekonomi (dari Daftar Pantauan Risiko Krisis Utang)</label>
        <select value={lamp} onChange={(e) => changeLamp(e.target.value as Lamp)} className={inputCls}>
          {(Object.keys(lampLabels) as Lamp[]).map((l) => (
            <option key={l} value={l}>
              {lampLabels[l]}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1">Menentukan batas harga beli. Disimpan di perangkat ini.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(['portofolio', 'watchlist'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              setOpenTicker(null)
              setEditing(null)
            }}
            className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {t === 'portofolio' ? `Portofolio (${portfolioRows.length})` : `Watchlist (${watchRows.length})`}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {tab === 'portofolio' ? 'Keputusan jual / tahan / tambah untuk saham yang sudah dimiliki.' : 'Keputusan beli untuk saham di watchlist yang belum dimiliki.'}
      </p>
      {tab === 'portofolio' && actionCount > 0 && (
        <p className="text-xs text-amber-700">{actionCount} saham punya sinyal selain TAHAN.</p>
      )}

      {rows.length === 0 && <p className="text-sm text-slate-600">Tidak ada saham di daftar ini.</p>}

      <div className="space-y-2">
        {rows.map((r) => {
          const open = openTicker === r.ticker
          const decision = r.sell?.decision ?? r.buy?.decision ?? (r.thesis ? 'DATA KURANG' : 'ISI THESIS')
          const result = r.sell ?? r.buy
          return (
            <div key={r.ticker} className="bg-white border border-slate-200 rounded-lg p-4">
              <button
                className="w-full text-left"
                onClick={() => {
                  setOpenTicker(open ? null : r.ticker)
                  setEditing(null)
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.ticker}</span>
                    {r.thesis && <span className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{r.thesis.jenis}</span>}
                  </div>
                  <span className={`text-xs font-semibold rounded px-2 py-0.5 ${badgeClass(decision)}`}>{decision}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {r.price ? `Harga ${fmtNum(r.price)}` : 'Harga -'}
                  {' · '}
                  {r.fairValue ? `Nilai wajar ${fmtNum(r.fairValue)}` : 'Nilai wajar belum ada'}
                  {result?.ratio != null && ` · Rasio ${result.ratio.toFixed(2).replace('.', ',')}`}
                  {result?.expectedReturn != null && ` · Imbal hasil ${pct(result.expectedReturn)}/th`}
                  {r.held && ` · Bobot ${pct(r.weight)}`}
                </p>
              </button>

              {open && (
                <div className="mt-3 space-y-3">
                  {result && <p className="text-sm text-slate-700">{result.detail}</p>}
                  {r.sell?.alerts.map((a) => (
                    <p key={a} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      {a}
                    </p>
                  ))}
                  {r.buy?.maxPrice && (
                    <p className="text-xs text-slate-600">
                      Harga beli maksimum (lampu {lamp}): <span className="font-medium">{fmtNum(r.buy.maxPrice)}</span> · Porsi maks{' '}
                      {pct(r.buy.maxWeight, 0)} · Tahap 1 ≈ {pct(r.buy.tranchePct)} dari portofolio
                    </p>
                  )}
                  {r.sell?.buyLimitPrice && r.sell.decision === 'TAHAN' && (
                    <p className="text-xs text-slate-600">Zona tambah di harga ≤ {fmtNum(r.sell.buyLimitPrice)} (lampu {lamp}).</p>
                  )}
                  {result && <PathList path={result.path} mode={r.held ? 'sell' : 'buy'} />}

                  {r.thesis && (
                    <div className="border-t border-slate-200 pt-3 space-y-2 text-sm">
                      {r.thesis.ringkasan && (
                        <div>
                          <p className="text-xs text-slate-500">Thesis</p>
                          <p className="text-slate-800 whitespace-pre-line">{r.thesis.ringkasan}</p>
                        </div>
                      )}
                      {r.thesis.alasan_beli && (
                        <div>
                          <p className="text-xs text-slate-500">Alasan membeli</p>
                          <p className="text-slate-800 whitespace-pre-line">{r.thesis.alasan_beli}</p>
                        </div>
                      )}
                      {r.thesis.pematah_tesis.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500">Syarat batal</p>
                          <ul className="list-disc pl-5 text-slate-800">
                            {r.thesis.pematah_tesis.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs text-slate-400">
                        {r.thesis.sumber ? `Sumber: ${r.thesis.sumber}` : 'Sumber report belum diisi'}
                        {r.thesis.tanggal_initiate && ` · Initiate ${r.thesis.tanggal_initiate}`}
                        {r.thesis.tanggal_pemeriksaan_terakhir && ` · Diperiksa ${r.thesis.tanggal_pemeriksaan_terakhir}`}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 text-sm">
                    <button onClick={() => setEditing(editing === r.ticker ? null : r.ticker)} className="text-blue-600 hover:text-blue-700">
                      {r.thesis ? 'Edit thesis' : 'Isi thesis'}
                    </button>
                    {r.held && r.thesis && r.price && (
                      <button onClick={() => markChecked(r.thesis as StockThesis, r.price as number)} className="text-slate-600 hover:text-slate-800">
                        Catat pemeriksaan hari ini
                      </button>
                    )}
                  </div>

                  {editing === r.ticker && (
                    <ThesisForm
                      ticker={r.ticker}
                      initial={r.thesis}
                      held={r.held}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null)
                        loadTheses()
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
