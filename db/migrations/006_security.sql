-- 006 · Security hardening
-- Run in Neon → SQL Editor (same branch + database as the Data API). Safe to run again.
-- Existing rows are not touched: new limits apply to new writes only (NOT VALID).
--
-- What it closes:
--   1. A row could point to SOMEONE ELSE's recurring payment / goal (foreign keys skip RLS):
--      transactions.recurring_id and transfers.goal_id must now belong to the same user.
--   2. Any table created later was readable by every signed-in user automatically
--      (default privileges) — if RLS were forgotten on it, all users would see each other's rows.
--      Now a new table gets no access until it's granted explicitly together with RLS.
--   3. Unbounded values: huge amounts (> 2^53 lose precision in the browser), dates in year 9999,
--      100 KB category names. Now bounded.
--   4. One account could fill the free database with junk rows. Now each user has a row quota.

-- ─── 1. Signed-in users only; nothing for anonymous / public ─────────────────
alter default privileges in schema public revoke select, insert, update, delete on tables from authenticated;
revoke all on all tables in schema public from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anonymous') then
    execute 'revoke all on all tables in schema public from anonymous';
    execute 'revoke all on all functions in schema public from anonymous';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  accounts, recurring_payments, transactions, transfers, budget_allocations, goals, user_settings
  to authenticated;

-- RLS on every table (again — in case a table was recreated without it)
do $$
declare t text;
begin
  foreach t in array array['accounts', 'recurring_payments', 'transactions', 'transfers', 'budget_allocations', 'goals', 'user_settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated
         using ((select auth.user_id()) = user_id)
         with check ((select auth.user_id()) = user_id)', t);
  end loop;
end $$;

-- ─── 2. References must stay inside the user's own data ──────────────────────
create or replace function pome_tx_recurring_owned() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.recurring_id is not null and not exists (
    select 1 from recurring_payments r where r.id = new.recurring_id and r.user_id = new.user_id
  ) then
    raise exception 'recurring payment not found' using errcode = '23503';
  end if;
  return new;
end $$;

create or replace function pome_transfer_goal_owned() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if new.goal_id is not null and not exists (
    select 1 from goals g where g.id = new.goal_id and g.user_id = new.user_id
  ) then
    raise exception 'goal not found' using errcode = '23503';
  end if;
  return new;
end $$;

drop trigger if exists tx_recurring_owned on transactions;
create trigger tx_recurring_owned before insert or update of recurring_id, user_id on transactions
  for each row execute function pome_tx_recurring_owned();

drop trigger if exists transfer_goal_owned on transfers;
create trigger transfer_goal_owned before insert or update of goal_id, user_id on transfers
  for each row execute function pome_transfer_goal_owned();

-- ─── 3. Value limits (new writes only) ───────────────────────────────────────
-- 10^15 minor units = 10 trillion in any currency, and below 2^53 so the browser keeps every digit.
do $$
declare
  c record;
begin
  for c in select * from (values
    ('transactions',       'transactions_amount_range',     'abs(amount_minor) <= 1000000000000000'),
    ('transactions',       'transactions_category_len',     'length(category) between 1 and 40'),
    ('transactions',       'transactions_date_range',       'date between date ''2000-01-01'' and date ''2100-12-31'''),
    ('transfers',          'transfers_amount_range',        'amount_minor <= 1000000000000000'),
    ('transfers',          'transfers_date_range',          'date between date ''2000-01-01'' and date ''2100-12-31'''),
    ('recurring_payments', 'recurring_amount_range',        'amount_minor <= 1000000000000000'),
    ('recurring_payments', 'recurring_category_len',        'length(category) between 1 and 40'),
    ('budget_allocations', 'budget_planned_range',          'planned_minor <= 1000000000000000'),
    ('budget_allocations', 'budget_category_len',           'length(category) between 1 and 40'),
    ('goals',              'goals_amounts_range',           'target_minor <= 1000000000000000 and saved_minor <= 1000000000000000 and monthly_contribution_minor <= 1000000000000000'),
    ('goals',              'goals_deadline_range',          'deadline between date ''2000-01-01'' and date ''2100-12-31'''),
    ('accounts',           'accounts_opening_range',        'abs(opening_balance_minor) <= 1000000000000000')
  ) as v(tbl, name, expr)
  loop
    execute format('alter table %I drop constraint if exists %I', c.tbl, c.name);
    execute format('alter table %I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
  end loop;
end $$;

-- ─── 4. Row quota per user ───────────────────────────────────────────────────
-- Generous for real use (≈ 40 operations a day for 3 years), stops scripted flooding.
create or replace function pome_row_quota() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  lim int := tg_argv[0]::int;
  n   int;
begin
  execute format('select count(*) from %I where user_id = $1', tg_table_name) into n using new.user_id;
  if n >= lim then
    raise exception 'row limit reached for %', tg_table_name using errcode = '54000';
  end if;
  return new;
end $$;

do $$
declare
  q record;
begin
  for q in select * from (values
    ('transactions', 50000), ('transfers', 20000), ('recurring_payments', 300),
    ('goals', 100), ('budget_allocations', 100)
  ) as v(tbl, lim)
  loop
    execute format('drop trigger if exists row_quota on %I', q.tbl);
    execute format('create trigger row_quota before insert on %I for each row execute function pome_row_quota(%L)', q.tbl, q.lim);
  end loop;
end $$;

-- Trigger functions are not callable through the Data API
revoke all on function pome_tx_recurring_owned(), pome_transfer_goal_owned(), pome_row_quota() from public;

-- IMPORTANT: afterwards open Neon → Data API → "Refresh schema cache".

-- Check: the first query returns 3 rows, the second returns 5
select tgname, tgrelid::regclass from pg_trigger where tgname in ('tx_recurring_owned', 'transfer_goal_owned') or (tgname = 'row_quota' and tgrelid = 'transactions'::regclass);
select count(*) as quota_triggers from pg_trigger where tgname = 'row_quota';
