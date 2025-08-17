import { handleUpload } from '@vercel/blob/client';
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
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Parse client payload to get user info
        let userInfo;
        try {
          userInfo = JSON.parse(clientPayload || '{}');
        } catch {
          throw new Error('Invalid client payload');
        }

        const { userId, userPlan } = userInfo;
        
        if (!userId) {
          throw new Error('User ID required');
        }

        // Verify user exists in our database
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', userId)
          .single();

        const actualUserPlan = profile?.plan || 'free';
        const maxFileSize = actualUserPlan === 'pro' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: maxFileSize,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('PDF uploaded to blob:', blob.url);
      },
    });

    return res.json(jsonResponse);
  } catch (error) {
    console.error('Blob upload error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate upload token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}