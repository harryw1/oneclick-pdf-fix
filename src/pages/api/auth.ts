import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { setSecurityHeaders } from '@/utils/security';

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
  // SECURITY: Set security headers and CORS
  setSecurityHeaders(res, req.headers.origin as string);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    // SECURITY: Proper Supabase authentication check
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({
        authenticated: false,
        user: null
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(200).json({
        authenticated: false,
        user: null
      });
    }

    // Get user profile for plan information
    const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: profile } = await userSupabase
      .from('profiles')
      .select('plan, usage_this_week')
      .eq('id', user.id)
      .single();

    res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        plan: profile?.plan || 'free',
        usage_this_week: profile?.usage_this_week || 0
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}