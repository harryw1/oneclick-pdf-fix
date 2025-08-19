import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders } from '@/utils/security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '100mb',
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // SECURITY: Set security headers and CORS
  setSecurityHeaders(res, req.headers.origin as string);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid authentication' });
  }

  // Get user profile to check tier
  const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: profile } = await userSupabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  // DEPRECATED: This endpoint is legacy - redirect to blob storage
  console.warn('DEPRECATED: Legacy upload endpoint accessed - redirecting to blob storage');
  console.log('User ID:', user.id, 'Plan:', profile?.plan || 'free');
  
  return res.status(410).json({
    error: 'Endpoint deprecated',
    message: 'This upload endpoint is no longer supported. Please use the blob storage upload endpoint.',
    redirectTo: '/api/blob/upload',
    upgrade: true
  });
}