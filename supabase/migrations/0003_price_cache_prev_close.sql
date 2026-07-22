-- Tambah previous close supaya Dashboard bisa hitung top gainers/losers hari ini
-- tanpa panggilan API terpisah di luar siklus cache yang sama.

alter table price_cache add column if not exists prev_close numeric;
