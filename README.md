# Portfolio Tracker Saham IDX

PWA untuk memantau portofolio saham IDX — transaksi, holding per sekuritas, harga live (Yahoo Finance), dan dashboard.

## Setup lokal

```bash
npm install
cp .env.example .env   # isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev
```

Skema database ada di `supabase/migrations/` — jalankan berurutan di SQL Editor project Supabase Anda.

## Build & test

```bash
npm run build
npx vitest run
```

## Deploy

Deploy ke Vercel (frontend + `/api/prices` sebagai Edge Function). Environment variables yang dibutuhkan di Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
