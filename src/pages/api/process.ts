import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { processDocument } from '@/utils/pdf-processor';
import { processRateLimit, checkRateLimit } from '@/utils/rate-limit';
import { setSecurityHeaders, validateProcessingId, sanitizeInput } from '@/utils/security';
import type { PDFProcessingOptions } from '@/types/pdf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
    responseLimit: false,
  },
  maxDuration: 120,
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

  // SECURITY: Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  const identifier = Array.isArray(clientIP) ? clientIP[0] : clientIP;
  
  const rateLimitResult = await checkRateLimit(processRateLimit, identifier, 5, 60000);
  
  if (!rateLimitResult.success) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: 'Too many processing requests. Please try again later.',
      resetTime: rateLimitResult.reset
    });
  }

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body required' });
  }

  const { processingId, blobUrl, originalFileName, options = {} } = req.body as {
    processingId: string;
    blobUrl: string;
    originalFileName: string;
    options: PDFProcessingOptions;
  };

  // SECURITY: Enhanced input validation
  if (!processingId || !blobUrl || !originalFileName) {
    return res.status(400).json({ error: 'Processing ID, blob URL, and filename required' });
  }

  if (!validateProcessingId(processingId)) {
    return res.status(400).json({ error: 'Invalid processing ID format' });
  }

  if (!blobUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid blob URL - must use HTTPS' });
  }

  const sanitizedFileName = sanitizeInput(originalFileName);
  if (sanitizedFileName !== originalFileName) {
    console.warn('Filename contained potentially dangerous characters, sanitized');
  }

  // Get current user
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

  // Get user profile to determine processing approach
  let { data: profile } = await userSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const { data: newProfile, error: createError } = await userSupabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        plan: 'free',
        usage_this_week: 0,
        total_pages_processed: 0
      })
      .select()
      .single();

    if (createError) {
      return res.status(500).json({ error: 'Failed to create user profile' });
    }
    profile = newProfile;
  }

  const isPro = profile.plan === 'pro_monthly' || profile.plan === 'pro_annual';

  try {
    if (isPro) {
      // Pro users: Process immediately with priority
      console.log('Pro user detected - processing immediately');
      
      const result = await processDocument({
        processingId,
        blobUrl,
        originalFileName,
        options,
        userId: user.id,
        userToken: token
      });

      // Update usage statistics
      const newUsage = profile.usage_this_week + result.pageCount;
      const newTotal = profile.total_pages_processed + result.pageCount;
      const newUsageThisMonth = (profile.usage_this_month || 0) + result.pageCount;
      
      await userSupabase
        .from('profiles')
        .update({ 
          usage_this_week: newUsage,
          usage_this_month: newUsageThisMonth,
          total_pages_processed: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      // Add processing record to history
      await userSupabase
        .from('processing_history')
        .insert({
          id: processingId,
          user_id: user.id,
          original_filename: originalFileName,
          processed_url: result.processedUrl,
          page_count: result.pageCount,
          file_size: result.fileSize,
          options,
          processed_at: new Date().toISOString()
        });

      res.status(200).json({ 
        result,
        immediate: true,
        usage: {
          pagesProcessedThisMonth: newUsageThisMonth,
          monthlyLimit: 100
        }
      });

    } else {
      // Free users: Check for active Pro processing, queue if necessary
      console.log('Free user detected - checking queue status');

      // Check if any Pro users are currently processing
      const { count: activeProJobs } = await userSupabase
        .from('processing_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing')
        .eq('priority', 1); // Pro priority

      if (activeProJobs && activeProJobs > 0) {
        // Queue the free user
        console.log('Pro users are processing - queueing free user');
        
        const { data: queueItem, error: queueError } = await userSupabase
          .from('processing_queue')
          .insert({
            user_id: user.id,
            processing_id: processingId,
            blob_url: blobUrl,
            original_filename: originalFileName,
            options,
            priority: 2 // Free user priority
          })
          .select()
          .single();

        if (queueError) {
          throw new Error('Failed to add to processing queue');
        }

        // Get queue position
        const { count: queuePosition } = await userSupabase
          .from('processing_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued')
          .lt('created_at', queueItem.created_at);

        res.status(202).json({ 
          queued: true,
          position: (queuePosition || 0) + 1,
          estimatedWaitTime: (queuePosition || 0) * 30, // 30 seconds per job
          message: 'Added to priority queue. Pro users are currently processing.'
        });

      } else {
        // No Pro users processing, handle immediately
        console.log('No Pro users in queue - processing free user immediately');
        
        const result = await processDocument({
          processingId,
          blobUrl,
          originalFileName,
          options,
          userId: user.id,
          userToken: token
        });

        // Update usage statistics
        const newUsage = profile.usage_this_week + result.pageCount;
        const newTotal = profile.total_pages_processed + result.pageCount;
        
        await userSupabase
          .from('profiles')
          .update({ 
            usage_this_week: newUsage,
            total_pages_processed: newTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        // Add processing record to history
        await userSupabase
          .from('processing_history')
          .insert({
            id: processingId,
            user_id: user.id,
            original_filename: originalFileName,
            processed_url: result.processedUrl,
            page_count: result.pageCount,
            file_size: result.fileSize,
            options,
            processed_at: new Date().toISOString()
          });

        res.status(200).json({ 
          result, 
          immediate: true,
          usage: {
            pagesProcessedThisWeek: newUsage,
            weeklyLimit: 5,
            remainingPages: Math.max(0, 5 - newUsage)
          }
        });
      }
    }

  } catch (error) {
    // SECURITY: Log detailed errors server-side, return generic message to client
    console.error('[PROCESS ERROR]', {
      processingId,
      userId: user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Processing failed',
        message: 'Unable to process PDF. Please try again or contact support.'
      });
    }
  }
}