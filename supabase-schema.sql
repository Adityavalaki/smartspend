-- ═══════════════════════════════════════════════════
-- SmartSpend v6 — Supabase PostgreSQL Schema
-- Run this entire file in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- ── TRANSACTIONS ──────────────────────────────────
create table if not exists ss_transactions (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  amount      numeric(10,2) not null check (amount > 0),
  category    text not null,
  type        text not null check (type in ('income','expense')),
  pay_mode    text not null default 'cash',
  tx_date     date not null,
  description text default '',
  recurring   boolean default false,
  created_at  timestamptz default now()
);

-- ── WALLETS ───────────────────────────────────────
create table if not exists ss_wallets (
  id       bigserial primary key,
  user_id  uuid references auth.users(id) on delete cascade not null,
  name     text not null,
  balance  numeric(10,2) default 0,
  unique(user_id, name)
);

-- ── TRANSFERS ─────────────────────────────────────
create table if not exists ss_transfers (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  from_wallet  text not null,
  to_wallet    text not null,
  amount       numeric(10,2) not null check (amount > 0),
  note         text default '',
  tx_date      date not null,
  created_at   timestamptz default now()
);

-- ── SETTINGS ──────────────────────────────────────
create table if not exists ss_settings (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  setting_key   text not null,
  setting_value text,
  updated_at    timestamptz default now(),
  unique(user_id, setting_key)
);

-- ── GOALS ─────────────────────────────────────────
create table if not exists ss_goals (
  id             bigserial primary key,
  user_id        uuid references auth.users(id) on delete cascade not null,
  name           text not null,
  target_amount  numeric(10,2) not null,
  saved_amount   numeric(10,2) default 0,
  target_date    date not null,
  created_at     timestamptz default now()
);

-- ── SPLITS ────────────────────────────────────────
create table if not exists ss_splits (
  id            bigserial primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  description   text not null,
  total_amount  numeric(10,2) not null,
  split_date    date not null,
  created_at    timestamptz default now()
);

create table if not exists ss_split_people (
  id        bigserial primary key,
  split_id  bigint references ss_splits(id) on delete cascade not null,
  name      text not null,
  amount    numeric(10,2) not null
);

-- ═══════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — users see only their data
-- ═══════════════════════════════════════════════════

alter table ss_transactions   enable row level security;
alter table ss_wallets         enable row level security;
alter table ss_transfers       enable row level security;
alter table ss_settings        enable row level security;
alter table ss_goals           enable row level security;
alter table ss_splits          enable row level security;
alter table ss_split_people    enable row level security;

-- Transactions
create policy "own_transactions" on ss_transactions
  for all using (auth.uid() = user_id);

-- Wallets
create policy "own_wallets" on ss_wallets
  for all using (auth.uid() = user_id);

-- Transfers
create policy "own_transfers" on ss_transfers
  for all using (auth.uid() = user_id);

-- Settings
create policy "own_settings" on ss_settings
  for all using (auth.uid() = user_id);

-- Goals
create policy "own_goals" on ss_goals
  for all using (auth.uid() = user_id);

-- Splits
create policy "own_splits" on ss_splits
  for all using (auth.uid() = user_id);

-- Split people (inherit via split ownership)
create policy "own_split_people" on ss_split_people
  for all using (
    split_id in (
      select id from ss_splits where user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════
-- INDEXES for performance
-- ═══════════════════════════════════════════════════
create index if not exists idx_tx_user_date    on ss_transactions(user_id, tx_date desc);
create index if not exists idx_tx_user_type    on ss_transactions(user_id, type);
create index if not exists idx_wallets_user    on ss_wallets(user_id);
create index if not exists idx_settings_user   on ss_settings(user_id);
create index if not exists idx_goals_user      on ss_goals(user_id);
create index if not exists idx_splits_user     on ss_splits(user_id);
create index if not exists idx_transfers_user  on ss_transfers(user_id);
