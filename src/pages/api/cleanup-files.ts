import { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';
import { list, del } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseApiKey = process.env.SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl!, supabaseApiKey!);

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
    let filesScanned = 0;
    let filesDeleted = 0;
    let blobsScanned = 0;
    let blobsDeleted = 0;
    let errors = 0;

    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    // Part 1: Clean up legacy temp files in /tmp directory
    try {
      const tmpDir = '/tmp';
      const files = await fs.readdir(tmpDir);
      const processedFiles = files.filter(file => 
        file.endsWith('_processed.pdf') || file.includes('pdf_')
      );

      for (const fileName of processedFiles) {
        filesScanned++;
        const filePath = path.join(tmpDir, fileName);
        
        try {
          const stats = await fs.stat(filePath);
          const fileAge = stats.mtime.getTime();
          
          if (fileAge < twentyFourHoursAgo) {
            await fs.unlink(filePath);
            filesDeleted++;
            console.log(`Deleted expired temp file: ${fileName}`);
          }
        } catch (error) {
          errors++;
          console.error(`Error processing temp file ${fileName}:`, error);
        }
      }
    } catch (tmpError) {
      console.warn('Failed to clean tmp directory (may not exist in production):', tmpError);
    }

    // Part 2: Clean up Vercel Blob storage files
    try {
      console.log('Cleaning up Vercel Blob storage...');
      const { blobs } = await list();
      
      for (const blob of blobs) {
        blobsScanned++;
        
        // Check if blob is expired (older than 24 hours)
        const blobAge = new Date(blob.uploadedAt).getTime();
        const isExpired = blobAge < twentyFourHoursAgo;
        
        // For now, rely on upload timestamp for expiration checking
        // TODO: Future enhancement could store expiration data in database
        
        if (isExpired) {
          try {
            await del(blob.url);
            blobsDeleted++;
            console.log(`Deleted expired blob: ${blob.pathname} (age: ${Math.round((now - blobAge) / (1000 * 60 * 60))} hours)`);
          } catch (deleteError) {
            errors++;
            console.error(`Error deleting blob ${blob.pathname}:`, deleteError);
          }
        }
      }
    } catch (blobError) {
      errors++;
      console.error('Failed to clean blob storage:', blobError);
    }

    // Part 3: Clean up database records for expired files
    try {
      const { data: expiredRecords, error: dbError } = await supabase
        .from('processing_history')
        .delete()
        .lt('completed_at', new Date(twentyFourHoursAgo).toISOString())
        .select();

      if (dbError) {
        console.error('Failed to cleanup database records:', dbError);
        errors++;
      } else if (expiredRecords) {
        console.log(`Cleaned up ${expiredRecords.length} expired database records`);
      }
    } catch (dbCleanupError) {
      console.error('Database cleanup error:', dbCleanupError);
      errors++;
    }

    console.log(`Cleanup completed: ${filesScanned} temp files scanned, ${filesDeleted} temp files deleted, ${blobsScanned} blobs scanned, ${blobsDeleted} blobs deleted, ${errors} errors`);
    
    res.status(200).json({
      success: true,
      filesScanned,
      filesDeleted,
      blobsScanned,
      blobsDeleted,
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