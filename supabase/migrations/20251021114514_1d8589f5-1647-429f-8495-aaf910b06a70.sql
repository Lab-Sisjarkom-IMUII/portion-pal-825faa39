-- Clean up legacy cache entries with NULL user_id
DELETE FROM analysis_cache WHERE user_id IS NULL;

-- Update the RLS policy to remove NULL user_id access
DROP POLICY "Users can read their own cache" ON analysis_cache;

CREATE POLICY "Users can read their own cache"
  ON analysis_cache
  FOR SELECT
  USING (auth.uid() = user_id);