-- Portfolio Tracker Saham IDX — skema awal (MVP)

create table securities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  nama text not null,
  created_at timestamptz not null default now()
);

create table stocks (
  ticker text primary key,
  nama_perusahaan text,
  sektor text
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  security_id uuid not null references securities(id) on delete cascade,
  ticker text not null references stocks(ticker),
  tipe text not null check (tipe in ('buy', 'sell')),
  tanggal date not null,
  harga numeric not null check (harga > 0),
  lot numeric not null check (lot > 0),
  fee numeric not null default 0,
  created_at timestamptz not null default now()
);

create index transactions_user_id_idx on transactions(user_id);
create index transactions_security_id_idx on transactions(security_id);
create index transactions_ticker_idx on transactions(ticker);

create table price_cache (
  ticker text primary key,
  harga_terakhir numeric not null,
  timestamp timestamptz not null default now()
);

-- Row Level Security: setiap user hanya bisa akses datanya sendiri.
-- price_cache & stocks dibaca bersama (shared reference data, bukan milik user).

alter table securities enable row level security;
alter table transactions enable row level security;
alter table stocks enable row level security;
alter table price_cache enable row level security;

create policy "securities_owner_all" on securities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_owner_all" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "stocks_read_all" on stocks
  for select using (true);

create policy "stocks_authenticated_write" on stocks
  for insert with check (auth.role() = 'authenticated');

create policy "price_cache_read_all" on price_cache
  for select using (true);

create policy "price_cache_authenticated_write" on price_cache
  for insert with check (auth.role() = 'authenticated');

create policy "price_cache_authenticated_update" on price_cache
  for update using (auth.role() = 'authenticated');
