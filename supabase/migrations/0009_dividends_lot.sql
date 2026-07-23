-- Tambah jumlah lot ke catatan dividen, supaya bisa auto-hitung dari lot yang dipegang

alter table dividends add column if not exists lot numeric;
