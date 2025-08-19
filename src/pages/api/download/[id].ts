import { NextApiRequest, NextApiResponse } from 'next';
import { setSecurityHeaders, validateProcessingId } from '@/utils/security';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // SECURITY: Set security headers
  setSecurityHeaders(res, req.headers.origin as string);
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid processing ID' });
  }

  // SECURITY: Validate processing ID format to prevent path traversal
  if (!validateProcessingId(id)) {
    console.warn('Invalid processing ID format attempted:', id);
    return res.status(400).json({ error: 'Invalid processing ID format' });
  }

  // SECURITY: Authenticate user and verify ownership
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

  // Verify user owns this processing record and get the processed file URL
  const { data: processingRecord, error: recordError } = await supabase
    .from('processing_history')
    .select('id, user_id, status, processed_url, original_filename')
    .eq('processing_id', id)
    .eq('user_id', user.id)
    .single();

  if (recordError || !processingRecord) {
    console.warn('Processing record not found or access denied:', { processingId: id, userId: user.id });
    return res.status(404).json({ error: 'File not found or access denied' });
  }

  if (processingRecord.status !== 'completed') {
    return res.status(400).json({ error: 'File processing not completed' });
  }

  // Check if processed file URL exists
  if (!processingRecord.processed_url) {
    console.warn('No processed file URL found for processing ID:', id);
    return res.status(404).json({ error: 'Processed file not available' });
  }

  try {
    console.log('Fetching processed file from Blob storage:', processingRecord.processed_url);
    
    // Fetch the processed file from Vercel Blob
    const blobResponse = await fetch(processingRecord.processed_url);
    
    if (!blobResponse.ok) {
      console.error('Failed to fetch file from Blob storage:', blobResponse.status, blobResponse.statusText);
      return res.status(404).json({ error: 'File not found or expired' });
    }

    const fileBuffer = await blobResponse.arrayBuffer();
    console.log('File fetched successfully, size:', fileBuffer.byteLength);

    // Generate a clean filename based on original filename
    const originalName = processingRecord.original_filename || 'document';
    const cleanName = originalName.replace(/\.[^/.]+$/, ''); // Remove extension
    const downloadFilename = `${cleanName}_fixed.pdf`;

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', fileBuffer.byteLength);
    res.setHeader('Cache-Control', 'no-cache');

    // Send file
    res.status(200).send(Buffer.from(fileBuffer));
    console.log('File sent successfully');
    
  } catch (error) {
    console.error('Download error:', error);
    
    // SECURITY: Log detailed errors server-side, return generic message to client
    console.error('[DOWNLOAD ERROR]', {
      processingId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        message: 'Unable to download file. Please try again or contact support.'
      });
    }
  }
}