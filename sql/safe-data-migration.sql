-- OneClick PDF Fix - Safe Data Migration Script
-- This script safely migrates existing data to the new schema
-- Run this BEFORE the complete schema reset to backup data
-- Then run the restoration part AFTER the schema reset

-- ==============================================
-- PHASE 1: BACKUP EXISTING DATA
-- Run this section FIRST, before schema reset
-- ==============================================

-- Create temporary backup tables
CREATE TABLE IF NOT EXISTS temp_profiles_backup AS
SELECT 
  id,
  email,
  CASE 
    WHEN plan = 'pro' THEN 'pro_monthly'
    ELSE plan 
  END as plan,
  stripe_customer_id,
  stripe_subscription_id,
  usage_this_week,
  COALESCE(usage_this_month, usage_this_week) as usage_this_month, -- Fallback if column doesn't exist
  week_start_date,
  COALESCE(month_start_date, date_trunc('month', CURRENT_DATE)::date) as month_start_date,
  total_pages_processed,
  last_processed_at,
  created_at,
  updated_at
FROM public.profiles;

CREATE TABLE IF NOT EXISTS temp_processing_history_backup AS
SELECT 
  id,
  user_id,
  processing_id,
  original_filename,
  page_count,
  file_size_bytes,
  processing_options,
  status,
  NULL::TEXT as document_type, -- New column
  NULL::FLOAT as confidence_score, -- New column
  NULL::INTEGER as processing_duration_ms, -- New column
  NULL::TEXT as blob_url, -- New column  
  NULL::TEXT as processed_url, -- New column
  created_at,
  completed_at,
  NULL::TEXT as error_message -- New column
FROM public.processing_history;

-- Backup any existing processing_queue data if table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'processing_queue') THEN
    CREATE TABLE IF NOT EXISTS temp_processing_queue_backup AS
    SELECT * FROM public.processing_queue;
  ELSE
    -- Create empty backup table with expected structure
    CREATE TABLE IF NOT EXISTS temp_processing_queue_backup (
      id UUID,
      user_id UUID,
      processing_id TEXT,
      blob_url TEXT,
      original_filename TEXT,
      options JSONB,
      priority INTEGER,
      status TEXT,
      result JSONB,
      error_message TEXT,
      created_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      retry_count INTEGER,
      max_retries INTEGER
    );
  END IF;
END $$;

-- Log backup completion
DO $$
DECLARE
  v_profiles_count INTEGER;
  v_history_count INTEGER;
  v_queue_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profiles_count FROM temp_profiles_backup;
  SELECT COUNT(*) INTO v_history_count FROM temp_processing_history_backup;
  SELECT COUNT(*) INTO v_queue_count FROM temp_processing_queue_backup;
  
  RAISE NOTICE 'Backup completed:';
  RAISE NOTICE '- Profiles: % records', v_profiles_count;
  RAISE NOTICE '- Processing History: % records', v_history_count;
  RAISE NOTICE '- Processing Queue: % records', v_queue_count;
END $$;

-- ==============================================
-- PHASE 2: RESTORE DATA AFTER SCHEMA RESET
-- Run this section AFTER running the complete schema reset
-- ==============================================

-- Restore profiles data with plan enum conversion
INSERT INTO public.profiles (
  id, email, plan, stripe_customer_id, stripe_subscription_id,
  usage_this_week, usage_this_month, week_start_date, month_start_date,
  total_pages_processed, last_processed_at, created_at, updated_at
)
SELECT 
  id, email, plan, stripe_customer_id, stripe_subscription_id,
  usage_this_week, usage_this_month, week_start_date, month_start_date,
  total_pages_processed, last_processed_at, created_at, updated_at
FROM temp_profiles_backup
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  plan = EXCLUDED.plan,
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  usage_this_week = EXCLUDED.usage_this_week,
  usage_this_month = EXCLUDED.usage_this_month,
  week_start_date = EXCLUDED.week_start_date,
  month_start_date = EXCLUDED.month_start_date,
  total_pages_processed = EXCLUDED.total_pages_processed,
  last_processed_at = EXCLUDED.last_processed_at,
  updated_at = NOW();

-- Restore processing history with new columns
INSERT INTO public.processing_history (
  id, user_id, processing_id, original_filename, page_count, file_size_bytes,
  processing_options, status, document_type, confidence_score, 
  processing_duration_ms, blob_url, processed_url,
  created_at, completed_at, error_message
)
SELECT 
  id, user_id, processing_id, original_filename, page_count, file_size_bytes,
  processing_options, status, document_type, confidence_score,
  processing_duration_ms, blob_url, processed_url,
  created_at, completed_at, error_message
FROM temp_processing_history_backup
ON CONFLICT (processing_id) DO UPDATE SET
  original_filename = EXCLUDED.original_filename,
  page_count = EXCLUDED.page_count,
  file_size_bytes = EXCLUDED.file_size_bytes,
  processing_options = EXCLUDED.processing_options,
  status = EXCLUDED.status,
  completed_at = EXCLUDED.completed_at;

-- Restore processing queue if there was data
INSERT INTO public.processing_queue (
  id, user_id, processing_id, blob_url, original_filename, options,
  priority, status, result, error_message, created_at, started_at, 
  completed_at, retry_count, max_retries
)
SELECT 
  COALESCE(id, gen_random_uuid()), user_id, processing_id, blob_url, 
  original_filename, COALESCE(options, '{}'::jsonb), COALESCE(priority, 2), 
  COALESCE(status, 'queued'), result, error_message, 
  COALESCE(created_at, NOW()), started_at, completed_at,
  COALESCE(retry_count, 0), COALESCE(max_retries, 3)
FROM temp_processing_queue_backup
WHERE processing_id IS NOT NULL
ON CONFLICT (processing_id) DO NOTHING;

-- ==============================================
-- PHASE 3: DATA VALIDATION AND CLEANUP
-- ==============================================

-- Validate restored data
DO $$
DECLARE
  v_profiles_restored INTEGER;
  v_history_restored INTEGER;
  v_queue_restored INTEGER;
  v_profiles_backup INTEGER;
  v_history_backup INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_profiles_restored FROM public.profiles;
  SELECT COUNT(*) INTO v_history_restored FROM public.processing_history;
  SELECT COUNT(*) INTO v_queue_restored FROM public.processing_queue;
  SELECT COUNT(*) INTO v_profiles_backup FROM temp_profiles_backup;
  SELECT COUNT(*) INTO v_history_backup FROM temp_processing_history_backup;
  
  RAISE NOTICE 'Data restoration summary:';
  RAISE NOTICE '- Profiles: %/% restored', v_profiles_restored, v_profiles_backup;
  RAISE NOTICE '- Processing History: %/% restored', v_history_restored, v_history_backup;
  RAISE NOTICE '- Processing Queue: % items restored', v_queue_restored;
  
  -- Check for any data integrity issues
  IF v_profiles_restored < v_profiles_backup THEN
    RAISE WARNING 'Some profiles may not have been restored properly';
  END IF;
  
  IF v_history_restored < v_history_backup THEN
    RAISE WARNING 'Some processing history may not have been restored properly';
  END IF;
END $$;

-- Fix any usage statistics discrepancies
DO $$
DECLARE
  rec RECORD;
  v_actual_total INTEGER;
  v_actual_week INTEGER;
  v_actual_month INTEGER;
  v_updated INTEGER := 0;
BEGIN
  RAISE NOTICE 'Validating and correcting usage statistics...';
  
  FOR rec IN SELECT id FROM public.profiles LOOP
    -- Calculate actual usage from processing history
    SELECT 
      COALESCE(SUM(page_count), 0),
      COALESCE(SUM(CASE WHEN date_trunc('week', created_at::date) = date_trunc('week', CURRENT_DATE) THEN page_count ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN date_trunc('month', created_at::date) = date_trunc('month', CURRENT_DATE) THEN page_count ELSE 0 END), 0)
    INTO v_actual_total, v_actual_week, v_actual_month
    FROM public.processing_history
    WHERE user_id = rec.id AND status = 'completed';
    
    -- Update if there are discrepancies
    UPDATE public.profiles
    SET 
      total_pages_processed = v_actual_total,
      usage_this_week = v_actual_week,
      usage_this_month = v_actual_month,
      updated_at = NOW()
    WHERE id = rec.id
    AND (
      total_pages_processed != v_actual_total OR
      usage_this_week != v_actual_week OR
      usage_this_month != v_actual_month
    );
    
    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Updated usage statistics for % users', v_updated;
END $$;

-- ==============================================
-- PHASE 4: CLEANUP BACKUP TABLES
-- Only run this after confirming everything works correctly
-- ==============================================

-- Uncomment these lines after verifying the migration was successful:
-- DROP TABLE IF EXISTS temp_profiles_backup;
-- DROP TABLE IF EXISTS temp_processing_history_backup;
-- DROP TABLE IF EXISTS temp_processing_queue_backup;

-- ==============================================
-- MIGRATION INSTRUCTIONS:
-- 
-- STEP 1: Run Phase 1 (backup) before any schema changes
-- STEP 2: Run the complete-schema-reset.sql script
-- STEP 3: Run Phase 2 (restore) to migrate data to new schema
-- STEP 4: Run Phase 3 (validation) to check data integrity
-- STEP 5: After confirming everything works, run Phase 4 (cleanup)
-- 
-- If anything goes wrong, you can always restore from the backup tables
-- ==============================================