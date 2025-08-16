import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  
  console.log('Download request for ID:', id);
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid processing ID' });
  }

  try {
    const filePath = `/tmp/${id}_processed.pdf`;
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
    
    // Ensure we always send valid response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to download file',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}