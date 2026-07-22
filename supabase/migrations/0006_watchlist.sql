-- Watchlist: saham yang dipantau (belum tentu ada posisi) + nilai wajar & margin of safety

create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  ticker text not null references stocks(ticker),
  metode_valuasi text not null check (metode_valuasi in ('graham', 'per_pbv', 'dcf', 'ddm')),
  asumsi jsonb not null default '{}'::jsonb,
  nilai_wajar numeric,
  tanggal_update timestamptz not null default now(),
  unique (user_id, ticker)
);

create index watchlist_user_id_idx on watchlist(user_id);

alter table watchlist enable row level security;

create policy "watchlist_owner_all" on watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
