-- Add fiber column to user_meals table
ALTER TABLE public.user_meals 
ADD COLUMN IF NOT EXISTS fiber FLOAT;

-- Add comment for documentation
COMMENT ON COLUMN public.user_meals.fiber IS 'Fiber content in grams';

