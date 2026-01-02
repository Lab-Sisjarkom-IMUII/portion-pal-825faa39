-- Create user_goals table
CREATE TABLE public.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('lose_weight', 'reduce_calories')),
  age INTEGER NOT NULL CHECK (age > 0 AND age < 150),
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  height NUMERIC NOT NULL CHECK (height > 0),
  weight NUMERIC NOT NULL CHECK (weight > 0),
  activity TEXT NOT NULL CHECK (activity IN ('sedentary', 'moderate', 'active')),
  target_time TEXT NOT NULL,
  target_weight NUMERIC CHECK (target_weight > 0),
  ai_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own goals"
  ON public.user_goals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.user_goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.user_goals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.user_goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_user_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_user_goals_updated_at
  BEFORE UPDATE ON public.user_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_goals_updated_at();