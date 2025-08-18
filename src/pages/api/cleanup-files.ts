import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

export const config = {
  maxDuration: 60,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify this is called from a cron job
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('File cleanup cron job started...');

  try {
    const tmpDir = '/tmp';
    let filesScanned = 0;
    let filesDeleted = 0;
    let errors = 0;

    // Read all files in /tmp directory
    const files = await fs.readdir(tmpDir);
    
    // Filter for processed PDF files (pattern: *_processed.pdf)
    const processedFiles = files.filter(file => file.endsWith('_processed.pdf'));
    
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000); // 24 hours in milliseconds

    for (const fileName of processedFiles) {
      filesScanned++;
      const filePath = path.join(tmpDir, fileName);
      
      try {
        const stats = await fs.stat(filePath);
        const fileAge = stats.mtime.getTime();
        
        // Delete files older than 24 hours
        if (fileAge < twentyFourHoursAgo) {
          await fs.unlink(filePath);
          filesDeleted++;
          console.log(`Deleted expired file: ${fileName} (age: ${Math.round((now - fileAge) / (1000 * 60 * 60))} hours)`);
        }
      } catch (error) {
        errors++;
        console.error(`Error processing file ${fileName}:`, error);
      }
    }

    console.log(`Cleanup completed: ${filesScanned} files scanned, ${filesDeleted} files deleted, ${errors} errors`);
    
    res.status(200).json({
      success: true,
      filesScanned,
      filesDeleted,
      errors,
      message: 'File cleanup completed successfully'
    });

  } catch (error) {
    console.error('File cleanup error:', error);
    res.status(500).json({ 
      error: 'File cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}