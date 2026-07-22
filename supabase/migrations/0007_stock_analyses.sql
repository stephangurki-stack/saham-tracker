-- Catatan analisa laporan keuangan per saham, per periode (tahunan/triwulan)

create table stock_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  ticker text not null references stocks(ticker),
  periode_tipe text not null check (periode_tipe in ('tahunan', 'triwulan')),
  tahun integer not null,
  triwulan integer check (triwulan between 1 and 4),
  judul text,
  catatan text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_analyses_user_id_idx on stock_analyses(user_id);
create index stock_analyses_ticker_idx on stock_analyses(ticker);

alter table stock_analyses enable row level security;

create policy "stock_analyses_owner_all" on stock_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
