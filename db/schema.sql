-- ─── POME database schema (Neon Postgres) ────────────────────────────────────
-- Run once in Neon Console → SQL Editor, AFTER enabling Neon Auth and the Data API.
--
-- • Money is stored in minor units (cents / tiyn) as bigint — no float rounding.
-- • Every row belongs to a user: user_id defaults to auth.user_id() (the signed-in
--   user from the JWT) and Row Level Security lets people see only their own rows.
-- • The browser talks to these tables through the Neon Data API — there is no
--   backend server to maintain.

create table if not exists accounts (
  id                     text        not null check (id in ('cash', 'main', 'savings')),
  user_id                text        not null default (auth.user_id()),
  opening_balance_minor  bigint      not null default 0,
  currency               text        not null default 'USD',
  created_at             timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists recurring_payments (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null default (auth.user_id()),
  name          text        not null check (length(name) between 1 and 80),
  category      text        not null,
  amount_minor  bigint      not null check (amount_minor > 0),
  account_id    text        not null check (account_id in ('cash', 'main', 'savings')),
  frequency     text        not null check (frequency in ('monthly', 'yearly')),
  day           smallint    not null check (day between 1 and 31),
  month         smallint             check (month between 0 and 11),
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists transactions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null default (auth.user_id()),
  date          date        not null,
  description   text        not null default '' check (length(description) <= 120),
  category      text        not null,
  amount_minor  bigint      not null check (amount_minor <> 0),   -- + income, − expense
  account_id    text        not null check (account_id in ('cash', 'main', 'savings')),
  recurring_id  uuid        references recurring_payments(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists transactions_user_date on transactions (user_id, date);

create table if not exists transfers (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null default (auth.user_id()),
  date          date        not null,
  from_account  text        not null check (from_account in ('cash', 'main', 'savings')),
  to_account    text        not null check (to_account in ('cash', 'main', 'savings')),
  amount_minor  bigint      not null check (amount_minor > 0),
  note          text                 check (length(note) <= 120),
  created_at    timestamptz not null default now(),
  check (from_account <> to_account)
);
create index if not exists transfers_user_date on transfers (user_id, date);

create table if not exists budget_allocations (
  user_id        text   not null default (auth.user_id()),
  category       text   not null,
  planned_minor  bigint not null check (planned_minor >= 0),
  primary key (user_id, category)
);

create table if not exists goals (
  id                          uuid        primary key default gen_random_uuid(),
  user_id                     text        not null default (auth.user_id()),
  name                        text        not null check (length(name) between 1 and 80),
  target_minor                bigint      not null check (target_minor > 0),
  saved_minor                 bigint      not null default 0 check (saved_minor >= 0),
  deadline                    date        not null,
  monthly_contribution_minor  bigint      not null default 0 check (monthly_contribution_minor >= 0),
  created_at                  timestamptz not null default now()
);

-- ─── Currency: each money row keeps the currency it was entered in ─────────────
do $$
declare t text;
begin
  foreach t in array array['accounts', 'transactions', 'transfers', 'recurring_payments', 'goals', 'budget_allocations'] loop
    execute format('alter table %I add column if not exists currency text not null default %L', t, 'USD');
    execute format('alter table %I drop constraint if exists %I', t, t || '_currency_check');
    execute format('alter table %I add constraint %I check (currency in (%L, %L, %L, %L, %L))',
                   t, t || '_currency_check', 'KZT', 'MNT', 'USD', 'EUR', 'CNY');
  end loop;
end $$;

-- A transfer that tops up a goal points to it (goal top-ups ≠ the savings %)
alter table transfers add column if not exists goal_id uuid references goals(id) on delete set null;

-- Per-account settings (savings % of income)
create table if not exists user_settings (
  user_id       text         primary key default (auth.user_id()),
  savings_rate  numeric(4,3) not null default 0.05 check (savings_rate between 0 and 0.9),
  updated_at    timestamptz  not null default now()
);

-- ─── Access: signed-in users only, and only their own rows ───────────────────

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  accounts, recurring_payments, transactions, transfers, budget_allocations, goals, user_settings
  to authenticated;
-- No default privileges: a table added later gets no access until it is granted explicitly with RLS.
revoke all on all tables in schema public from public;

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

-- ─── Hardening (same as migrations/006_security.sql) ─────────────────────────
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
