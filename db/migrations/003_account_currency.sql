-- 003 · Account starting balances keep their currency too
-- Run in Neon → SQL Editor (same branch + database as the Data API). Safe to run again.
alter table accounts add column if not exists currency text not null default 'USD';

-- IMPORTANT: afterwards open Neon → Data API → "Refresh schema cache".

-- Check: must return 1 row
select table_name from information_schema.columns
where table_schema = 'public' and table_name = 'accounts' and column_name = 'currency';
