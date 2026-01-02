-- Create user_meals table if not exists
create extension if not exists pgcrypto;

create table if not exists public.user_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  food_name text,
  calories float,
  health_score float,
  protein float,
  carbs float,
  vegetables float,
  image_url text,
  created_at timestamp with time zone default now(),
  meal_date date generated always as (created_at::date) stored
);

-- RLS
alter table public.user_meals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_meals' and policyname = 'User can see own data'
  ) then
    create policy "User can see own data" on public.user_meals
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_meals' and policyname = 'User can insert own data'
  ) then
    create policy "User can insert own data" on public.user_meals
      for insert with check (auth.uid() = user_id);
  end if;
end $$;


