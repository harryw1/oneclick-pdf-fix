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

  const { filename, fileSize, contentType } = req.body;

  if (!filename || !fileSize || contentType !== 'application/pdf') {
    return res.status(400).json({ error: 'Missing or invalid file details' });
  }

  // Get user profile to check tier and limits
  const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  console.log('=== UPLOAD URL DEBUG INFO ===');
  console.log('User ID:', user.id);
  console.log('User profile:', profile);
  console.log('File size:', fileSize, 'bytes (', Math.round(fileSize / 1024 / 1024 * 100) / 100, 'MB)');

  // Determine file size limits based on user plan
  const userPlan = profile?.plan || 'free';
  const maxFileSize = (userPlan === 'pro_monthly' || userPlan === 'pro_annual') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  
  console.log('User plan:', userPlan);
  console.log('Max allowed size:', maxFileSize, 'bytes (', maxFileSize / 1024 / 1024, 'MB)');

  if (fileSize > maxFileSize) {
    return res.status(413).json({ 
      error: 'File too large',
      message: `File size exceeds ${userPlan === 'free' ? '10MB' : '100MB'} limit for ${userPlan} plan.`,
      userPlan,
      maxFileSizeMB: maxFileSize / (1024 * 1024),
      fileSizeMB: Math.round(fileSize / 1024 / 1024 * 100) / 100
    });
  }

  try {
    // Generate unique processing ID for the file
    const processingId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For now, we'll use a simple approach: store the processing ID and let the upload happen directly
    // The actual blob URL will be generated when the file is uploaded
    const expectedBlobUrl = `https://${process.env.VERCEL_URL || 'localhost:3000'}/api/blob/${processingId}.pdf`;

    console.log('Processing ID:', processingId);
    console.log('Expected blob URL:', expectedBlobUrl);

    res.status(200).json({
      processingId,
      uploadUrl: `/api/upload-blob/${processingId}`, // Our custom upload endpoint
      blobUrl: expectedBlobUrl,
      originalName: filename,
      message: 'Upload URL generated successfully'
    });

  } catch (error) {
    console.error('Failed to generate upload URL:', error);
    res.status(500).json({ 
      error: 'Failed to generate upload URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}