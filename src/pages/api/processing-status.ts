import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get auth token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.split(' ')[1];
    
    // Create authenticated supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Get user's active processing jobs
    const { data: activeOperations, error: operationsError } = await supabase
      .from('processing_operations')
      .select(`
        id,
        processing_id,
        operation_type,
        status,
        progress_percent,
        current_page,
        total_pages,
        metadata,
        created_at,
        last_checked_at
      `)
      .eq('user_id', user.id)
      .eq('status', 'running')
      .order('created_at', { ascending: false });

    if (operationsError) {
      console.error('Error fetching active operations:', operationsError);
      return res.status(500).json({ error: 'Failed to fetch processing status' });
    }

    // Get user's queue items
    const { data: queueItems, error: queueError } = await supabase
      .from('processing_queue')
      .select(`
        id,
        processing_id,
        original_filename,
        status,
        priority,
        created_at,
        started_at
      `)
      .eq('user_id', user.id)
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false });

    if (queueError) {
      console.error('Error fetching queue items:', queueError);
      return res.status(500).json({ error: 'Failed to fetch queue status' });
    }

    // Get recent completed/failed items for context
    const { data: recentHistory, error: historyError } = await supabase
      .from('processing_history')
      .select(`
        processing_id,
        original_filename,
        page_count,
        status,
        document_type,
        confidence_score,
        processing_duration_ms,
        created_at,
        completed_at
      `)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(5);

    if (historyError) {
      console.error('Error fetching recent history:', historyError);
    }

    // Calculate queue positions for queued items
    const queueItemsWithPosition = await Promise.all(
      (queueItems || [])
        .filter(item => item.status === 'queued')
        .map(async (item) => {
          const { count: position } = await supabase
            .from('processing_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'queued')
            .lt('created_at', item.created_at);

          return {
            ...item,
            queue_position: (position || 0) + 1,
            estimated_wait_time: (position || 0) * 30 // 30 seconds per job estimate
          };
        })
    );

    // Combine and format response
    const processingStatus = {
      active_operations: activeOperations || [],
      queue_items: queueItemsWithPosition,
      processing_items: (queueItems || []).filter(item => item.status === 'processing'),
      recent_history: recentHistory || [],
      summary: {
        total_active: (activeOperations || []).length,
        total_queued: queueItemsWithPosition.length,
        total_processing: (queueItems || []).filter(item => item.status === 'processing').length,
        estimated_total_wait: queueItemsWithPosition.reduce((sum, item) => sum + (item.estimated_wait_time || 0), 0)
      }
    };

    res.status(200).json({
      success: true,
      data: processingStatus
    });

  } catch (error) {
    console.error('Processing status API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch processing status'
    });
  }
}