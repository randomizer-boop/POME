-- 002 · Keep every amount in the currency it was entered in
-- Run in Neon → SQL Editor on the SAME branch + database the Data API uses
-- (Data API tab shows them; usually branch "production", database "neondb").
-- Safe to run again. Existing rows stay USD.

alter table transactions       add column if not exists currency text not null default 'USD';
alter table transfers          add column if not exists currency text not null default 'USD';
alter table recurring_payments add column if not exists currency text not null default 'USD';
alter table goals              add column if not exists currency text not null default 'USD';
alter table budget_allocations add column if not exists currency text not null default 'USD';

-- IMPORTANT: afterwards open Neon → Data API → "Refresh schema cache".
-- The Data API caches table shapes and won't see the new column until then.

-- Check: must return 5 rows (budget_allocations, goals, recurring_payments, transactions, transfers)
select table_name from information_schema.columns
where table_schema = 'public' and column_name = 'currency'
order by table_name;
