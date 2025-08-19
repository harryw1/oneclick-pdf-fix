-- OneClick PDF Fix Database Optimization and Fixes
-- This file contains SQL commands to run in Supabase Dashboard

-- ==============================================
-- 1. VERIFY AND FIX RLS POLICIES
-- ==============================================

-- Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('profiles', 'processing_history');

-- Ensure proper RLS policies for profiles table
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Ensure proper RLS policies for processing_history table
DROP POLICY IF EXISTS "Users can view own processing history" ON processing_history;
DROP POLICY IF EXISTS "Users can insert own processing history" ON processing_history;

CREATE POLICY "Users can view own processing history" ON processing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processing history" ON processing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==============================================
-- 2. ADD PERFORMANCE INDEXES
-- ==============================================

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_processing_history_user_id ON processing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_created_at ON processing_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_history_user_created ON processing_history(user_id, created_at DESC);

-- ==============================================
-- 3. CREATE DATABASE FUNCTIONS FOR CONSISTENCY
-- ==============================================

-- Function to safely update usage counters with proper locking
CREATE OR REPLACE FUNCTION update_user_usage_safe(
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
  v_current_profile profiles;
BEGIN
  -- Get current profile with row-level lock to prevent race conditions
  SELECT * INTO v_current_profile
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- If profile doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, plan, usage_this_week, total_pages_processed, created_at, updated_at)
    VALUES (
      p_user_id,
      (SELECT email FROM auth.users WHERE id = p_user_id),
      'free',
      p_page_count,
      p_page_count,
      now(),
      now()
    )
    RETURNING usage_this_week, total_pages_processed INTO v_current_profile.usage_this_week, v_current_profile.total_pages_processed;
  ELSE
    -- Update existing profile
    UPDATE profiles
    SET 
      usage_this_week = usage_this_week + p_page_count,
      total_pages_processed = total_pages_processed + p_page_count,
      updated_at = now()
    WHERE id = p_user_id
    RETURNING usage_this_week, total_pages_processed INTO v_current_profile.usage_this_week, v_current_profile.total_pages_processed;
  END IF;
  
  -- Return the updated values
  v_result = jsonb_build_object(
    'usage_this_week', v_current_profile.usage_this_week,
    'total_pages_processed', v_current_profile.total_pages_processed,
    'success', true
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RAISE LOG 'Error updating usage for user %: %', p_user_id, SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to get accurate usage statistics
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
  v_actual_total bigint;
  v_actual_week bigint;
  v_week_start date;
BEGIN
  -- Get the start of the current week (Monday)
  v_week_start = date_trunc('week', current_date);
  
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  -- Calculate actual totals from processing_history
  SELECT 
    COALESCE(SUM(page_count), 0),
    COALESCE(SUM(CASE WHEN date_trunc('week', created_at::date) = v_week_start THEN page_count ELSE 0 END), 0)
  INTO v_actual_total, v_actual_week
  FROM processing_history
  WHERE user_id = p_user_id AND status = 'completed';
  
  -- If there's a discrepancy, update the profile
  IF v_profile.total_pages_processed != v_actual_total OR v_profile.usage_this_week != v_actual_week THEN
    UPDATE profiles
    SET 
      total_pages_processed = v_actual_total,
      usage_this_week = v_actual_week,
      updated_at = now()
    WHERE id = p_user_id;
    
    RAISE LOG 'Corrected usage stats for user %: total % -> %, week % -> %', 
      p_user_id, v_profile.total_pages_processed, v_actual_total, v_profile.usage_this_week, v_actual_week;
  END IF;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'total_pages_processed', v_actual_total,
    'usage_this_week', v_actual_week,
    'plan', v_profile.plan,
    'corrected', (v_profile.total_pages_processed != v_actual_total OR v_profile.usage_this_week != v_actual_week)
  );
END;
$$;

-- ==============================================
-- 4. CREATE WEEKLY RESET FUNCTION (if not exists)
-- ==============================================

CREATE OR REPLACE FUNCTION reset_weekly_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset weekly usage counters every Monday
  UPDATE profiles
  SET 
    usage_this_week = 0,
    updated_at = now()
  WHERE date_trunc('week', updated_at) < date_trunc('week', current_date);
  
  RAISE LOG 'Weekly usage reset completed for % users', FOUND;
END;
$$;

-- ==============================================
-- 5. GRANT PERMISSIONS
-- ==============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_user_usage_safe(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(uuid) TO authenticated;

-- Grant permissions for service role (for cron jobs)
GRANT EXECUTE ON FUNCTION reset_weekly_usage() TO service_role;

-- ==============================================
-- 6. VERIFICATION QUERIES
-- ==============================================

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('profiles', 'processing_history') AND schemaname = 'public';

-- Check indexes were created
SELECT schemaname, tablename, indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('profiles', 'processing_history') AND schemaname = 'public';

-- Test the functions (run these after creating the functions)
-- SELECT get_user_stats(auth.uid()); -- Test with actual user ID
-- SELECT update_user_usage_safe(auth.uid(), 1); -- Test with actual user ID

-- ==============================================
-- 7. DATA INTEGRITY CHECK AND REPAIR
-- ==============================================

-- Find users with potential data integrity issues
SELECT 
  p.id,
  p.email,
  p.total_pages_processed as profile_total,
  p.usage_this_week as profile_week,
  COALESCE(h.actual_total, 0) as actual_total,
  COALESCE(h.actual_week, 0) as actual_week,
  CASE 
    WHEN p.total_pages_processed != COALESCE(h.actual_total, 0) OR 
         p.usage_this_week != COALESCE(h.actual_week, 0) THEN 'NEEDS_CORRECTION'
    ELSE 'OK'
  END as status
FROM profiles p
LEFT JOIN (
  SELECT 
    user_id,
    SUM(page_count) as actual_total,
    SUM(CASE WHEN date_trunc('week', created_at::date) = date_trunc('week', current_date) THEN page_count ELSE 0 END) as actual_week
  FROM processing_history
  WHERE status = 'completed'
  GROUP BY user_id
) h ON p.id = h.user_id
ORDER BY p.created_at DESC;

-- ==============================================
-- INSTRUCTIONS FOR RUNNING:
-- 1. Copy and paste sections 1-5 into Supabase Dashboard SQL Editor
-- 2. Run each section separately to verify no errors
-- 3. Run section 6 to verify everything was created correctly
-- 4. Run section 7 to check for data integrity issues
-- 5. Use the get_user_stats() function to fix any inconsistencies
-- ==============================================