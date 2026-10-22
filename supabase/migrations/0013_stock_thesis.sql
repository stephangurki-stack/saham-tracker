create table stock_thesis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  ticker text not null references stocks(ticker),
  jenis text not null check (jenis in ('Q', 'V', 'S')),
  is_bank boolean not null default false,
  is_msci boolean not null default false,
  tanggal_initiate date,
  sumber text,
  ringkasan text not null default '',
  alasan_beli text not null default '',
  pematah_tesis text[] not null default '{}',
  nilai_wajar_3th numeric check (nilai_wajar_3th is null or nilai_wajar_3th > 0),
  dividend_yield_pct numeric check (dividend_yield_pct is null or dividend_yield_pct >= 0),
  harga_pemeriksaan_terakhir numeric,
  tanggal_pemeriksaan_terakhir date,
  tanda_bahaya boolean not null default false,
  tesis_patah boolean not null default false,
  pengganti_lebih_baik boolean not null default false,
  saringan_lolos boolean,
  fscore integer check (fscore is null or (fscore between 0 and 9)),
  roe_ok boolean,
  checklist_lengkap boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker)
);

create index stock_thesis_user_id_idx on stock_thesis(user_id);

alter table stock_thesis enable row level security;

create policy "stock_thesis_owner_all" on stock_thesis
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
