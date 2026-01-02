-- Fix PUBLIC_CACHE_DATA security warning
-- Add user_id column to analysis_cache for proper access control
ALTER TABLE public.analysis_cache 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can read cached analysis" ON public.analysis_cache;
DROP POLICY IF EXISTS "Anyone can insert cached analysis" ON public.analysis_cache;

-- Create secure policies based on authenticated user
CREATE POLICY "Users can read their own cache"
  ON public.analysis_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own cache"
  ON public.analysis_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cache"
  ON public.analysis_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow edge function to insert cache using service role
CREATE POLICY "Service role can manage cache"
  ON public.analysis_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create index for better performance on user_id lookups
CREATE INDEX IF NOT EXISTS idx_analysis_cache_user_id ON public.analysis_cache(user_id);