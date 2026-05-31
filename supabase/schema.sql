-- pprclp Supabase schema and Row Level Security policies
-- Run this file in the Supabase SQL editor for a new project.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  current_streak integer not null default 0 check (current_streak >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  completed boolean not null,
  created_at timestamptz not null default now(),
  constraint habit_logs_habit_id_log_date_key unique (habit_id, log_date)
);


create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

create policy "Profiles are visible to their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

create policy "Habits are visible to their owner"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habits"
  on public.habits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own habits"
  on public.habits for delete
  using (auth.uid() = user_id);

create policy "Habit logs are visible to their owner"
  on public.habit_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own habit logs"
  on public.habit_logs for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits
      where habits.id = habit_logs.habit_id
        and habits.user_id = auth.uid()
    )
  );

create policy "Users can update their own habit logs"
  on public.habit_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own habit logs"
  on public.habit_logs for delete
  using (auth.uid() = user_id);

create index if not exists habits_user_id_created_at_idx on public.habits (user_id, created_at);
create index if not exists habit_logs_user_id_log_date_idx on public.habit_logs (user_id, log_date);
create index if not exists habit_logs_habit_id_log_date_idx on public.habit_logs (habit_id, log_date);
