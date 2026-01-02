-- Add unique constraint and composite index for analysis_cache security and performance
ALTER TABLE public.analysis_cache
  ADD CONSTRAINT uq_analysis_cache_user_image UNIQUE (user_id, image_hash);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_user_image
  ON public.analysis_cache(user_id, image_hash);


