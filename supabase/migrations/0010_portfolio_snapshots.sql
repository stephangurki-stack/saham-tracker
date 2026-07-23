-- Snapshot nilai portofolio (saham+kas) per tanggal, untuk perbandingan
-- pertumbuhan dari waktu ke waktu (mis. tahun ini vs tahun lalu). Terisi
-- otomatis tiap kali Dashboard dibuka (1 baris per hari), atau manual untuk
-- mengisi titik historis yang belum tercatat (mis. akhir tahun lalu).

create table portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  tanggal date not null,
  nilai_saham numeric,
  nilai_kas numeric,
  total numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, tanggal)
);

create index portfolio_snapshots_user_id_idx on portfolio_snapshots(user_id);

alter table portfolio_snapshots enable row level security;

create policy "portfolio_snapshots_owner_all" on portfolio_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
