import { NextApiRequest, NextApiResponse } from 'next';
import { put } from '@vercel/blob';
import { setSecurityHeaders } from '@/utils/security';

export const config = {
  api: {
    bodyParser: false, // We'll handle the raw body
  },
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // SECURITY: Set security headers
  setSecurityHeaders(res, req.headers.origin as string);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { processingId } = req.query;
  
  if (!processingId || Array.isArray(processingId)) {
    return res.status(400).json({ error: 'Invalid processing ID' });
  }

  console.log('=== BLOB UPLOAD HANDLER ===');
  console.log('Processing ID:', processingId);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Content-Length:', req.headers['content-length']);

  try {
    // Collect the raw body data
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      req.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      req.on('error', reject);
    });

    console.log('Received file buffer, size:', fileBuffer.length, 'bytes');

    // Validate it's a PDF
    if (!fileBuffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      return res.status(400).json({ error: 'Invalid PDF file' });
    }

    // Upload to Vercel Blob
    const filename = `${processingId}.pdf`;
    console.log('Uploading to Blob storage with filename:', filename);
    
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    console.log('✅ Successfully uploaded to Blob storage');
    console.log('Blob URL:', blob.url);

    res.status(200).json({
      success: true,
      blobUrl: blob.url,
      size: fileBuffer.length,
      processingId,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Blob upload error:', error);
    res.status(500).json({
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}