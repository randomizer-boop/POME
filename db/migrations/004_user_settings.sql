-- 004 · Per-account settings (savings %) stored in the database, not in the browser
-- Why: the % was kept in the browser, so two accounts on one computer shared it,
-- and the phone and the laptop could show different numbers.
-- Run in Neon → SQL Editor (same branch + database as the Data API). Safe to run again.

create table if not exists user_settings (
  user_id       text         primary key default (auth.user_id()),
  savings_rate  numeric(4,3) not null default 0.05 check (savings_rate between 0 and 0.9),
  updated_at    timestamptz  not null default now()
);

grant select, insert, update, delete on user_settings to authenticated;
alter table user_settings enable row level security;
drop policy if exists "own rows" on user_settings;
create policy "own rows" on user_settings for all to authenticated
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);

-- IMPORTANT: afterwards open Neon → Data API → "Refresh schema cache".

-- Check: must return 1 row
select table_name from information_schema.tables where table_schema = 'public' and table_name = 'user_settings';
