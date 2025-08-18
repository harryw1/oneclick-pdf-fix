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

    // Get recent processing history
    const { data: processingHistory, error } = await supabase
      .from('processing_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Processing history query error:', error);
      return res.status(500).json({ error: 'Failed to fetch processing history' });
    }

    // Format the response
    const formattedHistory = processingHistory.map(record => ({
      id: record.id,
      processingId: record.processing_id,
      originalFilename: record.original_filename,
      pageCount: record.page_count,
      fileSizeBytes: record.file_size_bytes,
      status: record.status,
      createdAt: record.created_at,
      completedAt: record.completed_at,
      processingOptions: record.processing_options || {}
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory
    });

  } catch (error) {
    console.error('Processing history error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch processing history'
    });
  }
}