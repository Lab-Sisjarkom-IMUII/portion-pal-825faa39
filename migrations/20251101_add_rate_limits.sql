-- Create rate_limits table for DB-backed rate limiting
-- Columns:
-- user_id: uuid/text identifying the user
-- window_start: timestamptz - start of the window
-- request_count: integer - number of requests in window

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start);
