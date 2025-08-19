-- OneClick PDF Fix - Complete Database Schema Reset
-- This script creates a fresh, consistent database schema
-- Run this in Supabase SQL Editor to reset the entire database

-- ==============================================
-- STEP 1: CLEAN SLATE - DROP EXISTING OBJECTS
-- ==============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;  
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own processing history" ON public.processing_history;
DROP POLICY IF EXISTS "Users can insert own processing history" ON public.processing_history;
DROP POLICY IF EXISTS "Users can update own processing history" ON public.processing_history;
DROP POLICY IF EXISTS "Users can view own queue items" ON public.processing_queue;
DROP POLICY IF EXISTS "Users can insert own queue items" ON public.processing_queue;
DROP POLICY IF EXISTS "Service can update queue items" ON public.processing_queue;
DROP POLICY IF EXISTS "Users can view own operations" ON public.processing_operations;
DROP POLICY IF EXISTS "Users can insert own operations" ON public.processing_operations;
DROP POLICY IF EXISTS "Service can update operations" ON public.processing_operations;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.reset_weekly_usage();
DROP FUNCTION IF EXISTS public.update_user_usage_safe(uuid, integer);
DROP FUNCTION IF EXISTS public.get_user_stats(uuid);
DROP FUNCTION IF EXISTS public.get_processing_progress(text);
DROP FUNCTION IF EXISTS public.cleanup_expired_operations();

-- Drop tables (in dependency order)
DROP TABLE IF EXISTS public.processing_operations CASCADE;
DROP TABLE IF EXISTS public.processing_queue CASCADE;
DROP TABLE IF EXISTS public.processing_history CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ==============================================
-- STEP 2: CREATE CORE TABLES
-- ==============================================

-- Profiles table with corrected plan enum and usage tracking
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro_monthly', 'pro_annual')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  usage_this_week INTEGER NOT NULL DEFAULT 0,
  usage_this_month INTEGER NOT NULL DEFAULT 0,
  week_start_date DATE NOT NULL DEFAULT date_trunc('week', CURRENT_DATE)::date,
  month_start_date DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  total_pages_processed INTEGER NOT NULL DEFAULT 0,
  last_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processing history table for completed jobs
CREATE TABLE public.processing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  processing_id TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  processing_options JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  document_type TEXT,
  confidence_score FLOAT,
  processing_duration_ms INTEGER,
  blob_url TEXT,
  processed_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Processing queue for job management and priority handling
CREATE TABLE public.processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processing_id TEXT NOT NULL UNIQUE,
  blob_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 2, -- 1 = Pro (high priority), 2 = Free (normal priority)
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  result JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3
);

-- Processing operations for Google Vision API long-running operations tracking
CREATE TABLE public.processing_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processing_id TEXT NOT NULL,
  operation_name TEXT NOT NULL, -- Google Vision API operation name
  operation_type TEXT NOT NULL CHECK (operation_type IN ('batch_annotate', 'document_text', 'web_detection')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  pages_processed INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  current_page INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  result JSONB DEFAULT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  check_interval_seconds INTEGER NOT NULL DEFAULT 30,
  CONSTRAINT fk_processing_operation FOREIGN KEY (processing_id) REFERENCES public.processing_history(processing_id) ON DELETE CASCADE
);

-- ==============================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- ==============================================

-- Profiles indexes
CREATE INDEX idx_profiles_plan ON public.profiles(plan);
CREATE INDEX idx_profiles_stripe_customer ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_profiles_updated_at ON public.profiles(updated_at);

-- Processing history indexes  
CREATE INDEX idx_processing_history_user_id ON public.processing_history(user_id);
CREATE INDEX idx_processing_history_created_at ON public.processing_history(created_at DESC);
CREATE INDEX idx_processing_history_user_created ON public.processing_history(user_id, created_at DESC);
CREATE INDEX idx_processing_history_processing_id ON public.processing_history(processing_id);
CREATE INDEX idx_processing_history_status ON public.processing_history(status);

-- Processing queue indexes
CREATE INDEX idx_processing_queue_priority_created ON public.processing_queue (priority, created_at) WHERE status = 'queued';
CREATE INDEX idx_processing_queue_user_id ON public.processing_queue (user_id);
CREATE INDEX idx_processing_queue_processing_id ON public.processing_queue (processing_id);
CREATE INDEX idx_processing_queue_status ON public.processing_queue (status);

-- Processing operations indexes
CREATE INDEX idx_processing_operations_processing_id ON public.processing_operations(processing_id);
CREATE INDEX idx_processing_operations_user_id ON public.processing_operations(user_id);
CREATE INDEX idx_processing_operations_status ON public.processing_operations(status);
CREATE INDEX idx_processing_operations_operation_name ON public.processing_operations(operation_name);
CREATE INDEX idx_processing_operations_last_checked ON public.processing_operations(last_checked_at) WHERE status = 'running';

-- ==============================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_operations ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- STEP 5: CREATE RLS POLICIES
-- ==============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Processing history policies
CREATE POLICY "Users can view own processing history" ON public.processing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processing history" ON public.processing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processing history" ON public.processing_history
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Processing queue policies
CREATE POLICY "Users can view own queue items" ON public.processing_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue items" ON public.processing_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can update queue items" ON public.processing_queue
  FOR UPDATE USING (true); -- Service role can update any queue item

-- Processing operations policies
CREATE POLICY "Users can view own operations" ON public.processing_operations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own operations" ON public.processing_operations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can update operations" ON public.processing_operations
  FOR UPDATE USING (true); -- Service role can update any operation

-- ==============================================
-- STEP 6: CREATE DATABASE FUNCTIONS
-- ==============================================

-- Function to handle user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    'free', 
    NOW(), 
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW; -- Don't fail user creation if profile creation fails
END;
$$;

-- Function to safely update user usage with atomic operations
CREATE OR REPLACE FUNCTION public.update_user_usage_safe(
  p_user_id uuid,
  p_page_count integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_profile profiles;
  v_week_start date;
  v_month_start date;
BEGIN
  -- Calculate current week and month starts
  v_week_start := date_trunc('week', CURRENT_DATE)::date;
  v_month_start := date_trunc('month', CURRENT_DATE)::date;
  
  -- Get current profile with row lock to prevent race conditions
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- If profile doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO profiles (
      id, email, plan, usage_this_week, usage_this_month, 
      week_start_date, month_start_date, total_pages_processed, created_at, updated_at
    )
    VALUES (
      p_user_id,
      (SELECT email FROM auth.users WHERE id = p_user_id),
      'free',
      p_page_count,
      p_page_count,
      v_week_start,
      v_month_start,
      p_page_count,
      NOW(),
      NOW()
    )
    RETURNING * INTO v_profile;
  ELSE
    -- Reset weekly usage if new week
    IF v_profile.week_start_date < v_week_start THEN
      v_profile.usage_this_week := 0;
      v_profile.week_start_date := v_week_start;
    END IF;
    
    -- Reset monthly usage if new month
    IF v_profile.month_start_date < v_month_start THEN
      v_profile.usage_this_month := 0;
      v_profile.month_start_date := v_month_start;
    END IF;
    
    -- Update existing profile
    UPDATE profiles
    SET 
      usage_this_week = v_profile.usage_this_week + p_page_count,
      usage_this_month = v_profile.usage_this_month + p_page_count,
      total_pages_processed = total_pages_processed + p_page_count,
      week_start_date = v_profile.week_start_date,
      month_start_date = v_profile.month_start_date,
      last_processed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_user_id
    RETURNING * INTO v_profile;
  END IF;
  
  -- Return the updated values
  v_result = jsonb_build_object(
    'usage_this_week', v_profile.usage_this_week,
    'usage_this_month', v_profile.usage_this_month,
    'total_pages_processed', v_profile.total_pages_processed,
    'success', true
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error updating usage for user %: %', p_user_id, SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to get accurate user statistics
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
  v_actual_total bigint;
  v_actual_week bigint;
  v_actual_month bigint;
  v_week_start date;
  v_month_start date;
BEGIN
  -- Get current week and month starts
  v_week_start := date_trunc('week', CURRENT_DATE)::date;
  v_month_start := date_trunc('month', CURRENT_DATE)::date;
  
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  -- Calculate actual totals from processing_history
  SELECT 
    COALESCE(SUM(page_count), 0),
    COALESCE(SUM(CASE WHEN date_trunc('week', created_at::date) = v_week_start THEN page_count ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN date_trunc('month', created_at::date) = v_month_start THEN page_count ELSE 0 END), 0)
  INTO v_actual_total, v_actual_week, v_actual_month
  FROM processing_history
  WHERE user_id = p_user_id AND status = 'completed';
  
  -- Check and correct discrepancies
  IF v_profile.total_pages_processed != v_actual_total OR 
     v_profile.usage_this_week != v_actual_week OR
     v_profile.usage_this_month != v_actual_month THEN
    
    UPDATE profiles
    SET 
      total_pages_processed = v_actual_total,
      usage_this_week = v_actual_week,
      usage_this_month = v_actual_month,
      updated_at = NOW()
    WHERE id = p_user_id;
    
    RAISE LOG 'Corrected usage stats for user %', p_user_id;
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'plan', v_profile.plan,
    'total_pages_processed', v_actual_total,
    'usage_this_week', v_actual_week,
    'usage_this_month', v_actual_month,
    'week_limit', CASE WHEN v_profile.plan = 'free' THEN 10 ELSE 999999 END,
    'month_limit', CASE WHEN v_profile.plan = 'free' THEN 10 ELSE 1000 END,
    'corrected', true
  );
END;
$$;

-- Function to get processing progress for long-running operations
CREATE OR REPLACE FUNCTION public.get_processing_progress(p_processing_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operation processing_operations;
  v_history processing_history;
  v_queue processing_queue;
BEGIN
  -- Get processing history
  SELECT * INTO v_history FROM processing_history WHERE processing_id = p_processing_id;
  
  IF NOT FOUND THEN
    -- Check if it's in the queue
    SELECT * INTO v_queue FROM processing_queue WHERE processing_id = p_processing_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'processing_id', p_processing_id,
        'status', v_queue.status,
        'progress_percent', CASE WHEN v_queue.status = 'queued' THEN 0 ELSE 10 END,
        'message', CASE WHEN v_queue.status = 'queued' THEN 'Waiting in queue' ELSE 'Processing started' END,
        'created_at', v_queue.created_at
      );
    ELSE
      RETURN jsonb_build_object('error', 'Processing ID not found');
    END IF;
  END IF;
  
  -- If completed, return completion info
  IF v_history.status = 'completed' THEN
    RETURN jsonb_build_object(
      'processing_id', p_processing_id,
      'status', 'completed',
      'progress_percent', 100,
      'page_count', v_history.page_count,
      'document_type', v_history.document_type,
      'processing_duration_ms', v_history.processing_duration_ms,
      'completed_at', v_history.completed_at
    );
  END IF;
  
  -- Check for active operation
  SELECT * INTO v_operation 
  FROM processing_operations 
  WHERE processing_id = p_processing_id 
  AND status = 'running'
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'processing_id', p_processing_id,
      'status', 'processing',
      'progress_percent', v_operation.progress_percent,
      'current_page', v_operation.current_page,
      'total_pages', v_operation.total_pages,
      'operation_type', v_operation.operation_type,
      'last_checked_at', v_operation.last_checked_at
    );
  END IF;
  
  -- Default response for processing status
  RETURN jsonb_build_object(
    'processing_id', p_processing_id,
    'status', v_history.status,
    'progress_percent', CASE WHEN v_history.status = 'failed' THEN 0 ELSE 50 END,
    'message', CASE WHEN v_history.status = 'failed' THEN v_history.error_message ELSE 'Processing in progress' END
  );
END;
$$;

-- Function to clean up expired operations and temporary files
CREATE OR REPLACE FUNCTION public.cleanup_expired_operations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleaned integer := 0;
BEGIN
  -- Clean up old completed/failed operations (older than 24 hours)
  DELETE FROM processing_operations
  WHERE status IN ('completed', 'failed') 
  AND completed_at < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS v_cleaned = ROW_COUNT;
  
  -- Clean up stale running operations (older than 2 hours without update)
  UPDATE processing_operations
  SET status = 'failed', 
      error_message = 'Operation timed out',
      completed_at = NOW()
  WHERE status = 'running' 
  AND last_checked_at < NOW() - INTERVAL '2 hours';
  
  RAISE LOG 'Cleaned up % expired operations', v_cleaned;
  RETURN v_cleaned;
END;
$$;

-- Function to reset weekly usage (for cron job)
CREATE OR REPLACE FUNCTION public.reset_weekly_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_week_start date;
BEGIN
  v_week_start := date_trunc('week', CURRENT_DATE)::date;
  
  UPDATE profiles 
  SET 
    usage_this_week = 0,
    week_start_date = v_week_start,
    updated_at = NOW()
  WHERE week_start_date < v_week_start;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RAISE LOG 'Weekly usage reset completed for % users', v_updated;
  RETURN v_updated;
END;
$$;

-- Function to reset monthly usage (for cron job)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
  v_month_start date;
BEGIN
  v_month_start := date_trunc('month', CURRENT_DATE)::date;
  
  UPDATE profiles 
  SET 
    usage_this_month = 0,
    month_start_date = v_month_start,
    updated_at = NOW()
  WHERE month_start_date < v_month_start;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RAISE LOG 'Monthly usage reset completed for % users', v_updated;
  RETURN v_updated;
END;
$$;

-- ==============================================
-- STEP 7: CREATE TRIGGERS
-- ==============================================

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- STEP 8: GRANT PERMISSIONS
-- ==============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_usage_safe(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_processing_progress(text) TO authenticated;

-- Grant permissions for service role (for cron jobs and background processing)
GRANT EXECUTE ON FUNCTION public.reset_weekly_usage() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_monthly_usage() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_operations() TO service_role;

-- Grant service role access to update operations and queue
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_operations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_queue TO service_role;
GRANT SELECT, UPDATE ON public.processing_history TO service_role;

-- ==============================================
-- STEP 9: VERIFICATION QUERIES
-- ==============================================

-- Verify tables were created
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'processing_history', 'processing_queue', 'processing_operations')
ORDER BY tablename;

-- Verify indexes were created
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'processing_history', 'processing_queue', 'processing_operations')
ORDER BY tablename, indexname;

-- Verify functions were created
SELECT proname, prokind, prosecdef 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
AND proname IN (
  'handle_new_user', 'update_user_usage_safe', 'get_user_stats', 
  'get_processing_progress', 'cleanup_expired_operations', 
  'reset_weekly_usage', 'reset_monthly_usage'
)
ORDER BY proname;

-- ==============================================
-- NOTES FOR MANUAL EXECUTION:
-- 1. Run this entire script in the Supabase SQL Editor
-- 2. Verify all verification queries return expected results
-- 3. Test with a sample user: SELECT get_user_stats(auth.uid());
-- 4. Test progress tracking: SELECT get_processing_progress('test-id');
-- ==============================================