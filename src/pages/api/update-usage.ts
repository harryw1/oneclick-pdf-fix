import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders } from '@/utils/security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  setSecurityHeaders(res, req.headers.origin as string);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  const { pageCount } = req.body;
  
  if (!pageCount || typeof pageCount !== 'number' || pageCount < 0) {
    return res.status(400).json({ error: 'Valid page count required' });
  }

  try {
    // Use the new atomic database function
    const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data, error } = await userSupabase.rpc('update_user_usage_safe', {
      p_user_id: user.id,
      p_page_count: pageCount
    });

    if (error) {
      console.error('Database function error:', error);
      return res.status(500).json({ error: 'Failed to update usage statistics' });
    }

    if (!data.success) {
      console.error('Usage update failed:', data.error);
      return res.status(500).json({ error: 'Failed to update usage statistics', details: data.error });
    }

    console.log(`Successfully updated usage for user ${user.id}: +${pageCount} pages`);
    
    res.status(200).json({
      success: true,
      usage_this_week: data.usage_this_week,
      total_pages_processed: data.total_pages_processed,
      pages_added: pageCount
    });

  } catch (error) {
    console.error('Update usage error:', error);
    res.status(500).json({ 
      error: 'Failed to update usage statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}