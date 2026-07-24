-- Manual override for the auto-calculated next-year dividend projection per ticker

create table dividend_projections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  ticker text not null references stocks(ticker),
  tahun integer not null,
  jumlah numeric not null check (jumlah >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ticker, tahun)
);

create index dividend_projections_user_id_idx on dividend_projections(user_id);

alter table dividend_projections enable row level security;

create policy "dividend_projections_owner_all" on dividend_projections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
