-- Create analysis_cache table for storing AI analysis results
CREATE TABLE IF NOT EXISTS public.analysis_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_hash TEXT NOT NULL UNIQUE,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.analysis_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for analysis_cache
-- Anyone can read cached results (public cache)
CREATE POLICY "Anyone can read cached analysis" 
ON public.analysis_cache 
FOR SELECT 
USING (true);

-- Anyone can insert new cached results
CREATE POLICY "Anyone can insert cached analysis" 
ON public.analysis_cache 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_analysis_cache_image_hash 
ON public.analysis_cache(image_hash);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_analysis_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_analysis_cache_updated_at
BEFORE UPDATE ON public.analysis_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_analysis_cache_updated_at();

-- Create function to clean old cache entries (older than 30 days)
CREATE OR REPLACE FUNCTION public.clean_old_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.analysis_cache 
  WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SET search_path = public;