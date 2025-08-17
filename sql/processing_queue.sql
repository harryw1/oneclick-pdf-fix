-- Processing Queue Table for Priority Processing
CREATE TABLE processing_queue (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Index for efficient queue processing
CREATE INDEX idx_processing_queue_priority_created ON processing_queue (priority, created_at) WHERE status = 'queued';

-- Index for user lookup
CREATE INDEX idx_processing_queue_user_id ON processing_queue (user_id);

-- Index for processing_id lookup
CREATE INDEX idx_processing_queue_processing_id ON processing_queue (processing_id);

-- RLS policies
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- Users can only see their own queue items
CREATE POLICY "Users can view own queue items" ON processing_queue
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own queue items
CREATE POLICY "Users can insert own queue items" ON processing_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only service role can update processing status
CREATE POLICY "Service can update queue items" ON processing_queue
  FOR UPDATE USING (true);