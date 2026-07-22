-- Investasi: setoran/penarikan dana ke akun sekuritas (terpisah dari transaksi beli/jual saham)

create table cash_flows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  security_id uuid not null references securities(id) on delete cascade,
  tipe text not null check (tipe in ('deposit', 'withdraw')),
  tanggal date not null,
  jumlah numeric not null check (jumlah > 0),
  created_at timestamptz not null default now()
);

create index cash_flows_user_id_idx on cash_flows(user_id);
create index cash_flows_security_id_idx on cash_flows(security_id);

alter table cash_flows enable row level security;

create policy "cash_flows_owner_all" on cash_flows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
