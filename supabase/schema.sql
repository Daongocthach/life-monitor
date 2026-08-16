create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  birth_date date,
  height_cm numeric(5,2) check (height_cm is null or height_cm > 0),
  timezone text not null default 'Asia/Ho_Chi_Minh',
  locale text not null default 'vi-VN',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.connected_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('health_connect','google_fit','apple_health','calendar','bank','manual','other')),
  display_name text not null,
  status text not null default 'active' check (status in ('active','expired','error','disconnected')),
  scopes text[] not null default '{}',
  config jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.connected_sources(id) on delete cascade,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  records_synced integer not null default 0 check (records_synced >= 0),
  sync_cursor text,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.connected_sources(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  reason text not null,
  suggestion jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','corrected','ignored')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.connected_sources(id) on delete set null,
  name text not null,
  account_type text not null check (account_type in ('cash','bank','ewallet','credit','investment','other')),
  currency text not null default 'VND' check (char_length(currency) = 3),
  current_balance numeric(18,2) not null default 0,
  external_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table public.account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id) on delete cascade,
  balance numeric(18,2) not null,
  recorded_at timestamptz not null default now(),
  source text not null default 'system' check (source in ('system','sync','manual'))
);

create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.transaction_categories(id) on delete set null,
  name text not null,
  type text not null check (type in ('income','expense','transfer')),
  icon text,
  color text,
  classification_keywords text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.financial_accounts(id) on delete set null,
  category_id uuid references public.transaction_categories(id) on delete set null,
  source_id uuid references public.connected_sources(id) on delete set null,
  type text not null check (type in ('income','expense','transfer')),
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'VND' check (char_length(currency) = 3),
  merchant text,
  description text,
  occurred_at timestamptz not null default now(),
  external_id text,
  review_status text not null default 'confirmed' check (review_status in ('confirmed','pending','corrected')),
  is_excluded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  period_type text not null check (period_type in ('week','month','custom')),
  start_date date not null,
  end_date date not null,
  total_limit numeric(18,2) not null check (total_limit >= 0),
  status text not null default 'active' check (status in ('draft','active','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade,
  category_id uuid not null references public.transaction_categories(id) on delete cascade,
  limit_amount numeric(18,2) not null check (limit_amount >= 0),
  alert_percent integer not null default 80 check (alert_percent between 1 and 100),
  created_at timestamptz not null default now(),
  unique (budget_id, category_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid,
  source_id uuid references public.connected_sources(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','doing','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  scheduled_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.connected_sources(id) on delete set null,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  event_type text not null default 'event',
  attendance_status text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  unique (source_id, external_id)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tracking_type text not null default 'boolean' check (tracking_type in ('boolean','count','duration','measurement')),
  target_value numeric(12,2) not null default 1 check (target_value >= 0),
  unit text not null default 'lần',
  schedule jsonb not null default '{"frequency":"daily"}'::jsonb,
  auto_complete_config jsonb not null default '{}'::jsonb,
  reminder_time time,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  log_date date not null default current_date,
  value numeric(12,2) not null default 0,
  is_completed boolean not null default false,
  source text not null default 'manual' check (source in ('manual','automation','sync')),
  evidence_type text,
  evidence_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

create table public.daily_health_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  source_id uuid references public.connected_sources(id) on delete set null,
  steps integer not null default 0 check (steps >= 0),
  distance_meters numeric(12,2) not null default 0 check (distance_meters >= 0),
  active_minutes integer not null default 0 check (active_minutes >= 0),
  active_energy_kcal numeric(10,2) not null default 0 check (active_energy_kcal >= 0),
  resting_heart_rate integer check (resting_heart_rate is null or resting_heart_rate > 0),
  average_heart_rate integer check (average_heart_rate is null or average_heart_rate > 0),
  min_heart_rate integer check (min_heart_rate is null or min_heart_rate > 0),
  max_heart_rate integer check (max_heart_rate is null or max_heart_rate > 0),
  sleep_minutes integer not null default 0 check (sleep_minutes >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, metric_date)
);

create table public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.connected_sources(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  deep_minutes integer not null default 0 check (deep_minutes >= 0),
  light_minutes integer not null default 0 check (light_minutes >= 0),
  rem_minutes integer not null default 0 check (rem_minutes >= 0),
  awake_minutes integer not null default 0 check (awake_minutes >= 0),
  sleep_score numeric(5,2) check (sleep_score is null or sleep_score between 0 and 100),
  external_id text,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at),
  unique (source_id, external_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid references public.connected_sources(id) on delete set null,
  workout_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes >= 0),
  distance_meters numeric(12,2) not null default 0 check (distance_meters >= 0),
  energy_kcal numeric(10,2) not null default 0 check (energy_kcal >= 0),
  average_heart_rate integer,
  max_heart_rate integer,
  external_id text,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at),
  unique (source_id, external_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('finance','health','habit','task','growth','other')),
  title text not null,
  description text,
  metric_key text not null,
  start_value numeric(18,2) not null default 0,
  target_value numeric(18,2) not null,
  current_value numeric(18,2) not null default 0,
  unit text not null,
  start_date date not null default current_date,
  target_date date,
  status text not null default 'active' check (status in ('draft','active','completed','paused','cancelled')),
  calculation_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add constraint tasks_goal_id_fkey foreign key (goal_id) references public.goals(id) on delete set null;

create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  value numeric(18,2) not null,
  source text not null default 'system' check (source in ('system','manual','sync','automation')),
  source_entity_type text,
  source_entity_id uuid,
  recorded_at timestamptz not null default now()
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null,
  income_total numeric(18,2) not null default 0,
  expense_total numeric(18,2) not null default 0,
  tasks_completed integer not null default 0,
  tasks_total integer not null default 0,
  habits_completed integer not null default 0,
  steps integer not null default 0,
  sleep_minutes integer not null default 0,
  active_minutes integer not null default 0,
  summary_text text,
  next_actions jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  primary key (user_id, summary_date)
);

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  insight_type text not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  recommended_action text,
  severity text not null default 'info' check (severity in ('info','attention','warning')),
  status text not null default 'active' check (status in ('active','dismissed','acted')),
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

create index connected_sources_user_id_idx on public.connected_sources (user_id);
create index sync_runs_user_started_idx on public.sync_runs (user_id, started_at desc);
create index sync_runs_source_id_idx on public.sync_runs (source_id);
create index review_items_user_status_idx on public.review_items (user_id, status, created_at desc);
create index review_items_source_id_idx on public.review_items (source_id);
create index financial_accounts_user_active_idx on public.financial_accounts (user_id, is_active);
create index financial_accounts_source_id_idx on public.financial_accounts (source_id);
create index balance_snapshots_account_time_idx on public.account_balance_snapshots (account_id, recorded_at desc);
create index balance_snapshots_user_id_idx on public.account_balance_snapshots (user_id);
create index transaction_categories_user_id_idx on public.transaction_categories (user_id);
create index transaction_categories_parent_id_idx on public.transaction_categories (parent_id);
create index transactions_user_time_idx on public.transactions (user_id, occurred_at desc);
create index transactions_user_type_time_idx on public.transactions (user_id, type, occurred_at desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_source_id_idx on public.transactions (source_id);
create index budgets_user_period_idx on public.budgets (user_id, start_date desc, end_date);
create index budget_items_user_id_idx on public.budget_items (user_id);
create index budget_items_budget_id_idx on public.budget_items (budget_id);
create index budget_items_category_id_idx on public.budget_items (category_id);
create index tasks_user_schedule_idx on public.tasks (user_id, scheduled_at desc);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_goal_id_idx on public.tasks (goal_id);
create index tasks_source_id_idx on public.tasks (source_id);
create index calendar_events_user_starts_idx on public.calendar_events (user_id, starts_at desc);
create index calendar_events_source_id_idx on public.calendar_events (source_id);
create index habits_user_active_idx on public.habits (user_id, is_active);
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);
create index habit_logs_habit_id_idx on public.habit_logs (habit_id);
create index daily_health_metrics_source_id_idx on public.daily_health_metrics (source_id);
create index sleep_sessions_user_started_idx on public.sleep_sessions (user_id, started_at desc);
create index sleep_sessions_source_id_idx on public.sleep_sessions (source_id);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index workouts_source_id_idx on public.workouts (source_id);
create index goals_user_status_idx on public.goals (user_id, status, target_date);
create index goal_progress_user_time_idx on public.goal_progress (user_id, recorded_at desc);
create index goal_progress_goal_id_idx on public.goal_progress (goal_id);
create index automation_rules_user_enabled_idx on public.automation_rules (user_id, is_enabled, next_run_at);
create index insights_user_status_idx on public.insights (user_id, status, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','connected_sources','review_items','financial_accounts','transactions',
    'budgets','tasks','calendar_events','habits','habit_logs','goals','automation_rules'
  ] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create or replace function private.bootstrap_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));

  insert into public.financial_accounts (user_id, name, account_type)
  values (new.id, 'Tiền mặt', 'cash');

  insert into public.transaction_categories (user_id, name, type, icon, color, is_system)
  values
    (new.id, 'Ăn uống', 'expense', 'utensils', '#ff9f43', true),
    (new.id, 'Đi lại', 'expense', 'car', '#62a8ff', true),
    (new.id, 'Mua sắm', 'expense', 'shopping-bag', '#a78bfa', true),
    (new.id, 'Sức khỏe', 'expense', 'heart', '#ff6b77', true),
    (new.id, 'Thu nhập', 'income', 'wallet', '#44d7a8', true);

  insert into public.habits (user_id, name, tracking_type, target_value, unit, auto_complete_config)
  values
    (new.id, 'Đi bộ 8.000 bước', 'count', 8000, 'bước', '{"metric":"steps"}'::jsonb),
    (new.id, 'Tập luyện 30 phút', 'duration', 30, 'phút', '{"metric":"active_minutes"}'::jsonb),
    (new.id, 'Ngủ trước 23:00', 'boolean', 1, 'lần', '{"metric":"sleep_start","before":"23:00"}'::jsonb);

  return new;
end;
$$;

revoke execute on function private.bootstrap_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.bootstrap_user();

alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'connected_sources','sync_runs','review_items','financial_accounts','account_balance_snapshots',
    'transaction_categories','transactions','budgets','budget_items','tasks','calendar_events',
    'habits','habit_logs','daily_health_metrics','sleep_sessions','workouts','goals','goal_progress',
    'automation_rules','daily_summaries','insights'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name, table_name);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
