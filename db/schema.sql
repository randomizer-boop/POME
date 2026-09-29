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
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

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
