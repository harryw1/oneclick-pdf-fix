import { handleUpload } from '@vercel/blob/client';
import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { uploadRateLimit, checkRateLimit } from '@/utils/rate-limit';

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
    // SECURITY: Environment validation
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN environment variable is missing');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Blob storage is not properly configured. Please contact support.',
        code: 'MISSING_BLOB_TOKEN'
      });
    }

    // SECURITY: Rate limiting
    const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
    const identifier = Array.isArray(clientIP) ? clientIP[0] : clientIP;
    
    const rateLimitResult = await checkRateLimit(uploadRateLimit, identifier, 10, 60000);
    
    if (!rateLimitResult.success) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded', 
        message: 'Too many upload requests. Please try again later.',
        resetTime: rateLimitResult.reset
      });
    }
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

        const { userId, authToken } = userInfo;
        
        if (!userId || !authToken) {
          throw new Error('User ID and auth token required');
        }

        // SECURITY: Validate that the provided user ID matches the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
        
        if (authError || !user || user.id !== userId) {
          throw new Error('Authentication failed or user ID mismatch');
        }

        // Verify user exists in our database and get their plan
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', userId)
          .single();

        const actualUserPlan = profile?.plan || 'free';
        // Set file size limits: 100MB for Pro users, 50MB for free users (increased from 10MB to avoid 413 errors)
        const maxFileSize = (actualUserPlan === 'pro_monthly' || actualUserPlan === 'pro_annual') ? 100 * 1024 * 1024 : 50 * 1024 * 1024;

        console.log(`Setting blob upload limits - User Plan: ${actualUserPlan}, Max Size: ${maxFileSize / 1024 / 1024}MB`);

        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: maxFileSize,
          addRandomSuffix: true,
          // Set cache control for 24-hour retention
          cacheControlMaxAge: 24 * 60 * 60, // 24 hours in seconds
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('PDF uploaded to blob:', blob.url);
      },
    });

    return res.json(jsonResponse);
  } catch (error) {
    console.error('Blob upload error:', error);
    
    // Provide specific error messages for common issues
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('Failed to retrieve the client token')) {
      return res.status(500).json({ 
        error: 'Blob storage configuration error',
        message: 'Unable to generate upload token. Please ensure BLOB_READ_WRITE_TOKEN is configured.',
        code: 'BLOB_TOKEN_ERROR',
        details: errorMessage
      });
    }
    
    if (errorMessage.includes('Authentication failed')) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: 'Please sign in again to continue.',
        code: 'AUTH_ERROR'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate upload token',
      message: 'An unexpected error occurred. Please try again.',
      details: errorMessage
    });
  }
}