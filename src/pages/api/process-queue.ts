import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { processDocument } from '@/utils/pdf-processor';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use service role key for queue processing
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const config = {
  maxDuration: 120,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is called from a cron job or internal source
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Processing queue worker started...');

  try {
    // Get next job from queue (highest priority, oldest first)
    const { data: nextJob, error: fetchError } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('status', 'queued')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !nextJob) {
      console.log('No jobs in queue');
      return res.status(200).json({ message: 'No jobs in queue' });
    }

    console.log(`Processing job ${nextJob.processing_id} for user ${nextJob.user_id} (priority ${nextJob.priority})`);

    // Mark job as processing
    await supabase
      .from('processing_queue')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', nextJob.id);

    // Process the PDF by calling the original process API logic
    try {
      const result = await processDocument({
        processingId: nextJob.processing_id,
        blobUrl: nextJob.blob_url,
        originalFileName: nextJob.original_filename,
        options: nextJob.options,
        userId: nextJob.user_id
      });

      // Mark job as completed
      await supabase
        .from('processing_queue')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
          result
        })
        .eq('id', nextJob.id);

      console.log(`Job ${nextJob.processing_id} completed successfully`);
      res.status(200).json({ message: 'Job processed successfully', result });

    } catch (error) {
      console.error(`Job ${nextJob.processing_id} failed:`, error);
      
      // Mark job as failed
      await supabase
        .from('processing_queue')
        .update({ 
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', nextJob.id);

      res.status(500).json({ error: 'Job processing failed' });
    }

  } catch (error) {
    console.error('Queue processor error:', error);
    res.status(500).json({ error: 'Queue processor failed' });
  }
}