-- Target dividen tahunan (portofolio-wide) untuk dibandingkan dengan realisasi

create table dividend_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  tahun integer not null,
  target numeric not null check (target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tahun)
);

create index dividend_targets_user_id_idx on dividend_targets(user_id);

alter table dividend_targets enable row level security;

create policy "dividend_targets_owner_all" on dividend_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
