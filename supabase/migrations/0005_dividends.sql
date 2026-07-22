-- Dividen diterima per saham per akun sekuritas

create table dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  security_id uuid not null references securities(id) on delete cascade,
  ticker text not null references stocks(ticker),
  cum_date date,
  ex_date date,
  tanggal_bayar date not null,
  jumlah_per_lembar numeric not null check (jumlah_per_lembar > 0),
  total numeric not null check (total > 0),
  created_at timestamptz not null default now()
);

create index dividends_user_id_idx on dividends(user_id);
create index dividends_ticker_idx on dividends(ticker);

alter table dividends enable row level security;

create policy "dividends_owner_all" on dividends
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
