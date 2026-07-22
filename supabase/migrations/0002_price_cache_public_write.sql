-- price_cache berisi data harga saham publik (non-sensitif), jadi proxy harga
-- (Vercel serverless function) bisa menulis cache pakai anon key tanpa perlu
-- service_role key. Ganti policy insert/update supaya tidak mensyaratkan
-- role authenticated (function tidak membawa sesi user).

drop policy if exists "price_cache_authenticated_write" on price_cache;
drop policy if exists "price_cache_authenticated_update" on price_cache;

create policy "price_cache_public_write" on price_cache
  for insert with check (true);

create policy "price_cache_public_update" on price_cache
  for update using (true);
