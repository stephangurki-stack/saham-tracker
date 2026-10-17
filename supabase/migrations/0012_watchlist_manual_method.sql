alter table watchlist drop constraint if exists watchlist_metode_valuasi_check;
alter table watchlist
  add constraint watchlist_metode_valuasi_check
  check (metode_valuasi in ('graham', 'per_pbv', 'dcf', 'ddm', 'manual'));
