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
    const { id: processingId } = req.query;
    
    if (!processingId || typeof processingId !== 'string') {
      return res.status(400).json({ error: 'Processing ID is required' });
    }

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

    // Use the database function to get comprehensive progress info
    const { data: progressData, error: progressError } = await supabase
      .rpc('get_processing_progress', { p_processing_id: processingId });

    if (progressError) {
      console.error('Error fetching processing progress:', progressError);
      return res.status(500).json({ error: 'Failed to fetch processing progress' });
    }

    if (!progressData) {
      return res.status(404).json({ error: 'Processing ID not found' });
    }

    // Check if user owns this processing ID
    if (progressData.error) {
      return res.status(404).json({ error: progressData.error });
    }

    // Get additional real-time operation data if available
    const { data: activeOperations } = await supabase
      .from('processing_operations')
      .select('*')
      .eq('processing_id', processingId)
      .eq('user_id', user.id)
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1);

    let enhancedProgress = progressData;

    // Enhance with real-time operation data if available
    if (activeOperations && activeOperations.length > 0) {
      const operation = activeOperations[0];
      enhancedProgress = {
        ...progressData,
        progress_percent: operation.progress_percent || progressData.progress_percent,
        current_page: operation.current_page || progressData.current_page,
        total_pages: operation.total_pages || progressData.total_pages,
        operation_type: operation.operation_type,
        metadata: operation.metadata,
        last_updated: operation.last_checked_at,
        operation_id: operation.id
      };
    }

    // Add queue information if still queued
    if (progressData.status === 'queued') {
      const { data: queueInfo } = await supabase
        .from('processing_queue')
        .select('*')
        .eq('processing_id', processingId)
        .eq('user_id', user.id)
        .single();

      if (queueInfo) {
        // Get queue position
        const { count: queuePosition } = await supabase
          .from('processing_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued')
          .lt('created_at', queueInfo.created_at);

        enhancedProgress = {
          ...enhancedProgress,
          queue_position: (queuePosition || 0) + 1,
          estimated_wait_time: (queuePosition || 0) * 30, // 30 seconds per job estimate
          priority: queueInfo.priority,
          queued_at: queueInfo.created_at
        };
      }
    }

    res.status(200).json({
      success: true,
      data: enhancedProgress
    });

  } catch (error) {
    console.error('Processing progress API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch processing progress'
    });
  }
}