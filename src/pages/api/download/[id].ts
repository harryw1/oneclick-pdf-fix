import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { setSecurityHeaders, validateProcessingId } from '@/utils/security';

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

  // SECURITY: Sanitize the ID and construct safe file path
  const sanitizedId = id.replace(/[^a-zA-Z0-9_]/g, '');
  const filePath = path.join('/tmp', `${sanitizedId}_processed.pdf`);
  
  // SECURITY: Ensure file path is within expected directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith('/tmp/')) {
    console.warn('Path traversal attempt detected:', filePath);
    return res.status(400).json({ error: 'Invalid file path' });
  }

  try {
    console.log('Looking for file at:', filePath);
    
    // Check if file exists
    try {
      await fs.access(filePath);
      console.log('File found, preparing download...');
    } catch (error) {
      console.log('File not found:', error);
      return res.status(404).json({ error: 'File not found or expired' });
    }

    // Read file
    let fileBuffer, stats;
    try {
      fileBuffer = await fs.readFile(filePath);
      stats = await fs.stat(filePath);
      console.log('File read successfully, size:', stats.size);
    } catch (error) {
      console.error('Failed to read file:', error);
      return res.status(500).json({ error: 'Failed to read processed file' });
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${id}_fixed.pdf"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');

    // Send file
    res.status(200).send(fileBuffer);
    console.log('File sent successfully');

    // Clean up file after download
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
        console.log('File cleaned up successfully');
      } catch (error) {
        console.error('Failed to clean up file:', error);
      }
    }, 1000);
    
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