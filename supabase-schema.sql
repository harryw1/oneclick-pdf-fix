-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  usage_this_week INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_pages_processed INTEGER NOT NULL DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create processing_history table to track individual jobs
CREATE TABLE IF NOT EXISTS public.processing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  processing_id TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  processing_options JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS on tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for processing_history
CREATE POLICY "Users can view own processing history" ON public.processing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processing history" ON public.processing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processing history" ON public.processing_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to handle user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to reset weekly usage
CREATE OR REPLACE FUNCTION public.reset_weekly_usage()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    usage_this_week = 0,
    week_start_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE week_start_date <= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS profiles_plan_idx ON public.profiles(plan);
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS processing_history_user_idx ON public.processing_history(user_id);
CREATE INDEX IF NOT EXISTS processing_history_created_idx ON public.processing_history(created_at);
