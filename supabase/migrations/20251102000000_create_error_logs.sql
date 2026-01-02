-- Create error_logs table for centralized error tracking
-- This table stores application errors for debugging and monitoring

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  error text,
  stack text,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  source text not null,
  context jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  timestamp timestamptz default now()
);

-- Create index for faster queries
create index if not exists error_logs_severity_idx on public.error_logs(severity);
create index if not exists error_logs_source_idx on public.error_logs(source);
create index if not exists error_logs_timestamp_idx on public.error_logs(timestamp desc);
create index if not exists error_logs_user_id_idx on public.error_logs(user_id) where user_id is not null;

-- Enable RLS (optional - you may want to restrict access)
alter table public.error_logs enable row level security;

-- Policy: Users can only see their own errors (if you want to restrict)
-- For now, we'll allow service role to insert (from Edge Functions)
-- and authenticated users to see their own errors
create policy "Users can see own errors" on public.error_logs
  for select using (auth.uid() = user_id);

-- Policy: Allow service role to insert (for Edge Functions)
-- Note: This is handled by service role key, not RLS
-- But we can create a policy for authenticated inserts
create policy "Authenticated users can insert errors" on public.error_logs
  for insert with check (auth.uid() = user_id or auth.uid() is null);

-- Optional: Create a function to automatically clean old errors (older than 30 days)
create or replace function cleanup_old_error_logs()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.error_logs
  where timestamp < now() - interval '30 days'
  and severity in ('low', 'medium'); -- Keep high and critical errors longer
end;
$$;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- Uncomment if you have pg_cron enabled:
-- select cron.schedule('cleanup-error-logs', '0 2 * * *', 'select cleanup_old_error_logs()');

-- Optional: Create performance_logs table for performance metrics
create table if not exists public.performance_logs (
  id uuid primary key default gen_random_uuid(),
  metric text not null,
  value numeric not null,
  unit text default 'ms',
  source text not null,
  context jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) on delete set null,
  timestamp timestamptz default now()
);

-- Create indexes for performance_logs
create index if not exists performance_logs_metric_idx on public.performance_logs(metric);
create index if not exists performance_logs_source_idx on public.performance_logs(source);
create index if not exists performance_logs_timestamp_idx on public.performance_logs(timestamp desc);

-- Enable RLS for performance_logs
alter table public.performance_logs enable row level security;

-- Policy: Users can see their own performance logs
create policy "Users can see own performance logs" on public.performance_logs
  for select using (auth.uid() = user_id);

-- Policy: Authenticated users can insert performance logs
create policy "Authenticated users can insert performance logs" on public.performance_logs
  for insert with check (auth.uid() = user_id or auth.uid() is null);

