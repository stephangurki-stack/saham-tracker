import type { StockType } from './types'

export type Lamp = 'hijau' | 'kuning' | 'merah'

export interface PathStep {
  no: number
  question: string
  /** true = triggers this step, false = passes, null = can't tell from data */
  yes: boolean | null
  detail: string
}

export const MAX_WEIGHT: Record<StockType, number> = { Q: 0.15, V: 0.12, S: 0.03 }

/** Ratio ceiling (price ÷ fair value) for buying/adding; null = do not buy. Kebijakan Membeli §6. */
export function buyRatioLimit(jenis: StockType, isBankOrMsci: boolean, lamp: Lamp): number | null {
  if (jenis === 'S') return lamp === 'hijau' ? 0.6 : lamp === 'kuning' ? 0.55 : null
  if (isBankOrMsci) return lamp === 'hijau' ? 0.65 : 0.6
  return lamp === 'hijau' ? 0.7 : lamp === 'kuning' ? 0.65 : 0.6
}

/** (fv3y ÷ price)^(1/3) − 1 + dividend yield. Null when fair value in 3 years is unknown. */
export function expectedReturn3y(price: number, fairValue3y: number | null, dividendYieldPct: number | null): number | null {
  if (!fairValue3y || price <= 0) return null
  return Math.pow(fairValue3y / price, 1 / 3) - 1 + (dividendYieldPct ?? 0) / 100
}

export function yearsHeld(firstBuyDate: string | null, now: Date): number | null {
  if (!firstBuyDate) return null
  return (now.getTime() - new Date(firstBuyDate).getTime()) / (365.25 * 24 * 3600 * 1000)
}

const pct = (n: number, d = 1) => (n * 100).toFixed(d).replace('.', ',') + '%'
const ratioStr = (n: number) => n.toFixed(2).replace('.', ',')

export interface SellInput {
  jenis: StockType
  isBank: boolean
  isMsci: boolean
  price: number
  fairValue: number | null
  fairValue3y: number | null
  dividendYieldPct: number | null
  /** Share of total portfolio value (stocks + cash), 0–1. */
  weight: number
  firstBuyDate: string | null
  lastCheckPrice: number | null
  tandaBahaya: boolean
  tesisPatah: boolean
  penggantiLebihBaik: boolean
  lamp: Lamp
  now?: Date
}

export type SellDecision =
  | 'JUAL SEMUA SEGERA'
  | 'JUAL'
  | 'JUAL SEBAGIAN'
  | 'KURANGI'
  | 'TUKAR'
  | 'EVALUASI'
  | 'TAHAN'
  | 'TAMBAH'
  | 'DATA KURANG'

export interface SellResult {
  decision: SellDecision
  detail: string
  ratio: number | null
  discount: number | null
  expectedReturn: number | null
  buyLimitPrice: number | null
  path: PathStep[]
  alerts: string[]
}

/** Kebijakan Jual–Tahan: Tujuh Pertanyaan, stops at the first YES. */
export function evaluateSell(i: SellInput): SellResult {
  const now = i.now ?? new Date()
  const ratio = i.fairValue ? i.price / i.fairValue : null
  const discount = ratio !== null ? 1 - ratio : null
  const ret = expectedReturn3y(i.price, i.fairValue3y, i.dividendYieldPct)
  const bankOrMsci = i.isBank || i.isMsci
  const buyLimit = buyRatioLimit(i.jenis, bankOrMsci, i.lamp)
  const buyLimitPrice = i.fairValue && buyLimit ? i.fairValue * buyLimit : null
  const alerts: string[] = []
  const path: PathStep[] = []
  let decision: SellDecision | null = null
  let detail = ''

  const decide = (d: SellDecision, text: string) => {
    if (decision === null) {
      decision = d
      detail = text
    }
  }

  path.push({
    no: 1,
    question: 'Ada tanda bahaya serius (PKPU, gagal bayar, opini bukan WTP, papan pemantauan, dll)?',
    yes: i.tandaBahaya,
    detail: i.tandaBahaya ? 'Ditandai di thesis: jual semua segera, tanpa menunggu jadwal.' : 'Tidak ada yang ditandai.',
  })
  if (i.tandaBahaya) decide('JUAL SEMUA SEGERA', 'Tanda bahaya serius (alasan jual 2).')

  path.push({
    no: 2,
    question: 'Tesis patah (salah satu syarat batal terjadi)?',
    yes: i.tesisPatah,
    detail: i.tesisPatah
      ? 'Ditandai di thesis: jual sekaligus dalam ±2 minggu setelah laporan keuangan terbit, berapa pun untung/ruginya.'
      : 'Tidak ada syarat batal yang ditandai.',
  })
  if (i.tesisPatah) decide('JUAL', 'Tesis patah (alasan jual 1): jual sekaligus ±2 minggu setelah LK terbit.')

  const dropped = i.lastCheckPrice !== null && i.price <= i.lastCheckPrice * 0.8
  path.push({
    no: 3,
    question: 'Harga turun ≥20% sejak pemeriksaan terakhir?',
    yes: i.lastCheckPrice === null ? null : dropped,
    detail:
      i.lastCheckPrice === null
        ? 'Harga pemeriksaan terakhir belum diisi.'
        : dropped
          ? `Harga ${Math.round(i.price)} vs ${Math.round(i.lastCheckPrice)} saat diperiksa. Periksa ulang tesis dalam 2 minggu.`
          : 'Tidak turun ≥20%.',
  })
  if (dropped) alerts.push('Harga turun ≥20% sejak pemeriksaan terakhir: periksa ulang tesis (tesis benar → pertimbangkan tambah).')

  const bigWeight = ratio !== null && i.weight > 0.2 && discount !== null && discount < 0.2
  path.push({
    no: 4,
    question: 'Bobot >20% DAN diskon <20%?',
    yes: ratio === null ? null : bigWeight,
    detail:
      ratio === null
        ? 'Nilai wajar belum ada.'
        : `Bobot ${pct(i.weight)}, diskon ${pct(discount ?? 0)}.${bigWeight ? ' Kurangi ke 15–18%.' : ''}`,
  })
  if (bigWeight) decide('KURANGI', 'Porsi terlalu besar (alasan jual 5): kurangi ke 15–18%.')

  let zoneDecision: SellDecision | null = null
  let zoneText = ''
  if (ratio !== null) {
    if (i.jenis === 'Q') {
      if (ratio > 1.25 && ret !== null && ret < 0.1) {
        zoneDecision = 'JUAL'
        zoneText = `Rasio ${ratioStr(ratio)} >1,25 dan perkiraan imbal hasil ${pct(ret)} <10%/tahun: jual semua.`
      } else if (ratio > 1.5) {
        zoneDecision = 'JUAL SEBAGIAN'
        zoneText = `Rasio ${ratioStr(ratio)} >1,50: jual 1/3 lagi (setelah 1/3 pertama di 1,25).`
      } else if (ratio > 1.25) {
        zoneDecision = 'JUAL SEBAGIAN'
        zoneText = `Rasio ${ratioStr(ratio)} di 1,25–1,50: jual 1/3.`
      }
    } else if (i.jenis === 'V') {
      if (ratio > 1.1) {
        zoneDecision = 'JUAL'
        zoneText = `Rasio ${ratioStr(ratio)} >1,10: jual semua (bertahap).`
      } else if (ratio > 1.0) {
        zoneDecision = 'JUAL SEBAGIAN'
        zoneText = `Rasio ${ratioStr(ratio)} di 1,00–1,10: jual separuh.`
      }
    } else {
      if (ratio > 1.0) {
        zoneDecision = 'JUAL'
        zoneText = `Rasio ${ratioStr(ratio)} >1,00: jual semua.`
      } else if (ratio > 0.9) {
        zoneDecision = 'JUAL SEBAGIAN'
        zoneText = `Rasio ${ratioStr(ratio)} di 0,90–1,00: jual separuh.`
      }
    }
  }
  if (!zoneDecision && ret !== null && ret < 0.1) {
    zoneDecision = 'JUAL SEBAGIAN'
    zoneText = `Perkiraan imbal hasil ${pct(ret)} <10%/tahun: mulai jual sebagian.`
  }
  path.push({
    no: 5,
    question: 'Harga di zona jual, ATAU perkiraan imbal hasil <10%/tahun?',
    yes: ratio === null ? null : zoneDecision !== null,
    detail:
      ratio === null
        ? 'Nilai wajar belum ada (isi di Watchlist).'
        : zoneDecision
          ? zoneText
          : `Rasio ${ratioStr(ratio)}${ret !== null ? `, imbal hasil ${pct(ret)}/tahun` : ' (nilai wajar 3 tahun belum diisi)'}: di zona tahan.`,
  })
  if (zoneDecision) decide(zoneDecision, zoneText)

  const yrs = yearsHeld(i.firstBuyDate, now)
  const limitYears = i.jenis === 'S' ? 2 : i.jenis === 'V' ? 3 : null
  const overdue = limitYears !== null && yrs !== null && yrs >= limitYears
  path.push({
    no: 6,
    question: 'Sudah melewati batas waktu (S 2 tahun, V 3 tahun)?',
    yes: limitYears === null ? false : yrs === null ? null : overdue,
    detail:
      limitYears === null
        ? 'Jenis Q: tidak ada batas selama nilai wajar terus tumbuh.'
        : yrs === null
          ? 'Tanggal mulai dipegang tidak diketahui.'
          : `Dipegang ${yrs.toFixed(1).replace('.', ',')} tahun (batas ${limitYears}).${overdue ? ' Lepas bila harga dan nilai wajar sama-sama jalan di tempat.' : ''}`,
  })
  if (overdue) decide('EVALUASI', `Lewat batas ${limitYears} tahun (alasan jual: jalan di tempat): lepas bila harga dan nilai wajar tidak bergerak.`)

  path.push({
    no: 7,
    question: 'Ada pengganti yang jelas lebih baik (diskon +25 poin atau imbal hasil +7%/tahun, sudah diriset sampai CALK)?',
    yes: i.penggantiLebihBaik,
    detail: i.penggantiLebihBaik ? 'Ditandai di thesis: tukar bertahap.' : 'Tidak ada yang ditandai.',
  })
  if (i.penggantiLebihBaik) decide('TUKAR', 'Ada pengganti yang jelas lebih baik (alasan jual 4): tukar bertahap.')

  if (decision === null) {
    if (ratio === null) {
      decision = 'DATA KURANG'
      detail = 'Nilai wajar belum ada di Watchlist, jadi zona harga tidak bisa dinilai.'
    } else if (
      i.jenis !== 'S' &&
      buyLimit !== null &&
      ratio <= buyLimit &&
      ret !== null &&
      ret >= 0.15 &&
      i.weight < MAX_WEIGHT[i.jenis]
    ) {
      decision = 'TAMBAH'
      detail = `Rasio ${ratioStr(ratio)} ≤ batas beli ${ratioStr(buyLimit)}, imbal hasil ${pct(ret)} ≥15%, bobot ${pct(i.weight)} < ${pct(MAX_WEIGHT[i.jenis], 0)}.`
    } else {
      decision = 'TAHAN'
      detail = 'Tidak ada alasan jual yang terpenuhi.'
      if (buyLimit !== null && ratio <= buyLimit && ret === null && i.jenis !== 'S') {
        detail += ' Sudah di zona beli, isi nilai wajar 3 tahun untuk menilai apakah boleh tambah.'
      }
    }
  }

  return { decision, detail, ratio, discount, expectedReturn: ret, buyLimitPrice, path, alerts }
}

export interface BuyInput {
  jenis: StockType
  isBank: boolean
  isMsci: boolean
  hasThesis: boolean
  ringkasan: string
  price: number | null
  fairValue: number | null
  fairValue3y: number | null
  dividendYieldPct: number | null
  saringanLolos: boolean | null
  fscore: number | null
  roeOk: boolean | null
  checklistLengkap: boolean
  lamp: Lamp
}

export type BuyDecision =
  | 'BELI TAHAP 1'
  | 'DAFTAR BELANJA'
  | 'LENGKAPI CHECKLIST'
  | 'LEWATI'
  | 'TIDAK MEMBELI'
  | 'DATA KURANG'

export interface BuyResult {
  decision: BuyDecision
  detail: string
  ratio: number | null
  expectedReturn: number | null
  maxPrice: number | null
  maxWeight: number
  tranchePct: number
  path: PathStep[]
}

/** Kebijakan Membeli §10: alur membeli dari awal sampai akhir. */
export function evaluateBuy(i: BuyInput): BuyResult {
  const bankOrMsci = i.isBank || i.isMsci
  const limit = buyRatioLimit(i.jenis, bankOrMsci, i.lamp)
  const ratio = i.price && i.fairValue ? i.price / i.fairValue : null
  const ret = i.price ? expectedReturn3y(i.price, i.fairValue3y, i.dividendYieldPct) : null
  const maxPrice = i.fairValue && limit ? i.fairValue * limit : null
  const maxWeight = MAX_WEIGHT[i.jenis]
  const path: PathStep[] = []

  const explained = i.ringkasan.trim().length > 0
  path.push({
    no: 1,
    question: 'Bisa jelaskan bisnisnya dalam dua menit?',
    yes: i.hasThesis ? !explained : null,
    detail: !i.hasThesis ? 'Thesis belum diisi.' : explained ? 'Ringkasan thesis sudah ditulis.' : 'Ringkasan thesis masih kosong.',
  })

  path.push({
    no: 2,
    question: 'Lolos saringan wajib (tata kelola, likuiditas, kualitas laba, utang, pihak berelasi, status)?',
    yes: i.saringanLolos === null ? null : !i.saringanLolos,
    detail:
      i.saringanLolos === null
        ? 'Belum dicek.'
        : i.saringanLolos
          ? 'Lolos.'
          : 'Gagal: lewati, atau masuk sebagai S (maks 3%, diskon ≥40%).',
  })

  let qualityFail: boolean | null = null
  let qualityDetail = ''
  if (i.jenis === 'V') {
    if (i.fscore === null) {
      qualityDetail = 'Skor kesehatan (F-score) belum diisi.'
    } else if (i.fscore >= 7) {
      qualityFail = false
      qualityDetail = `F-score ${i.fscore}/9: keuangan membaik.`
    } else if (i.fscore >= 5) {
      qualityFail = false
      qualityDetail = `F-score ${i.fscore}/9: campuran. Lanjut hanya dengan alasan tertulis dan porsi lebih kecil.`
    } else {
      qualityFail = true
      qualityDetail = `F-score ${i.fscore}/9: keuangan memburuk, lewati semurah apa pun.`
    }
  } else if (i.jenis === 'Q') {
    qualityFail = i.roeOk === null ? null : !i.roeOk
    qualityDetail = i.roeOk === null ? 'ROE ≥15% selama ≥5 tahun belum dicek.' : i.roeOk ? 'ROE ≥15% konsisten.' : 'ROE tidak memenuhi: lewati.'
  } else {
    qualityFail = false
    qualityDetail = 'Situasi khusus: tidak ada skor kualitas, ukuran kecil.'
  }
  path.push({ no: 3, question: 'Skor kesehatan / kualitas memadai (V: F-score ≥7 atau 5–6 beralasan, Q: ROE ≥15%)?', yes: qualityFail, detail: qualityDetail })

  path.push({
    no: 4,
    question: 'Nilai wajar satu angka tersedia?',
    yes: i.fairValue ? false : true,
    detail: i.fairValue ? `Nilai wajar ${Math.round(i.fairValue)} (dari Watchlist).` : 'Belum ada nilai wajar di Watchlist: riset lagi.',
  })

  const priceOk = ratio !== null && limit !== null && ratio <= limit
  const retOk = ret !== null && ret >= 0.15
  let priceDetail: string
  if (limit === null) priceDetail = 'Lampu merah: saham situasi khusus tidak dibeli.'
  else if (ratio === null) priceDetail = 'Harga atau nilai wajar belum ada.'
  else priceDetail = `Rasio ${ratioStr(ratio)} vs batas ${ratioStr(limit)}${maxPrice ? ` (harga maks ${Math.round(maxPrice)})` : ''}; imbal hasil ${ret === null ? 'belum bisa dihitung (isi nilai wajar 3 tahun)' : pct(ret) + '/tahun'}.`
  path.push({
    no: 5,
    question: 'Harga di bawah batas beli sesuai lampu, dan untung ≥15%/tahun?',
    yes: ratio === null || limit === null ? null : !(priceOk && retOk),
    detail: priceDetail,
  })

  path.push({
    no: 6,
    question: 'Porsi aman?',
    yes: false,
    detail: `Porsi maksimal ${pct(MAX_WEIGHT[i.jenis], 0)} dari portofolio; masuk 3 tahap, tahap 1 = ${pct(MAX_WEIGHT[i.jenis] / 3, 1)}. Cek juga batas MSCI ≤30%, eksportir dolar, dan kas di atas minimal.`,
  })

  path.push({
    no: 7,
    question: 'Checklist 10 butir sudah lengkap?',
    yes: !i.checklistLengkap,
    detail: i.checklistLengkap ? 'Lengkap.' : 'Belum dicentang lengkap di thesis.',
  })

  const base = { ratio, expectedReturn: ret, maxPrice, maxWeight, tranchePct: maxWeight / 3, path }

  if (!i.hasThesis || i.saringanLolos === null || !i.fairValue || (i.jenis === 'V' && i.fscore === null) || (i.jenis === 'Q' && i.roeOk === null)) {
    return { ...base, decision: 'DATA KURANG', detail: 'Lengkapi thesis, saringan, skor kualitas, dan nilai wajar dulu.' }
  }
  if (limit === null) return { ...base, decision: 'TIDAK MEMBELI', detail: 'Lampu merah: saham situasi khusus tidak dibeli.' }
  if (!i.saringanLolos || qualityFail) {
    return { ...base, decision: 'LEWATI', detail: !i.saringanLolos ? 'Gagal saringan wajib: lewati, atau masuk sebagai S (maks 3%).' : qualityDetail }
  }
  if (!priceOk || !retOk) {
    return {
      ...base,
      decision: 'DAFTAR BELANJA',
      detail: `Belum di zona beli. Pasang limit order di harga maks ${maxPrice ? Math.round(maxPrice) : '-'}.${ret !== null && !retOk ? ' Imbal hasil <15%/tahun.' : ''}`,
    }
  }
  if (!i.checklistLengkap) return { ...base, decision: 'LENGKAPI CHECKLIST', detail: 'Harga dan imbal hasil lolos. Lengkapi checklist 10 butir sebelum membeli.' }
  return {
    ...base,
    decision: 'BELI TAHAP 1',
    detail: `Lolos semua. Beli 1/3 dari porsi target (maks ${pct(maxWeight, 0)}); tahap berikutnya setelah laporan keuangan mengonfirmasi.`,
  }
}
