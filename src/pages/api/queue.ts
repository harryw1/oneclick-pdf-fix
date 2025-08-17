import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    // Add job to queue
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Get user profile to determine priority
    const { data: profile } = await userSupabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    const isPro = profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual';
    const priority = isPro ? 1 : 2; // 1 = Pro (high priority), 2 = Free (normal priority)

    const { processingId, blobUrl, originalFileName, options } = req.body;

    // Add to queue
    const { data: queueItem, error } = await userSupabase
      .from('processing_queue')
      .insert({
        user_id: user.id,
        processing_id: processingId,
        blob_url: blobUrl,
        original_filename: originalFileName,
        options: options || {},
        priority,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add to queue:', error);
      return res.status(500).json({ error: 'Failed to add to processing queue' });
    }

    // Get queue position
    const { count } = await userSupabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .or(`priority.lt.${priority},and(priority.eq.${priority},created_at.lt.${queueItem.created_at})`);

    res.status(200).json({ 
      queueItem,
      position: (count || 0) + 1,
      estimatedWaitTime: isPro ? 0 : (count || 0) * 30 // 30 seconds per job estimate
    });

  } else if (req.method === 'GET') {
    // Check queue status
    const { processingId } = req.query;
    
    if (!processingId) {
      return res.status(400).json({ error: 'Processing ID required' });
    }

    const { data: queueItem } = await supabase
      .from('processing_queue')
      .select('*')
      .eq('processing_id', processingId)
      .single();

    if (!queueItem) {
      return res.status(404).json({ error: 'Queue item not found' });
    }

    res.status(200).json({ queueItem });

  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}