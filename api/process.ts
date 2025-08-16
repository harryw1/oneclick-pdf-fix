import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, degrees } from 'pdf-lib';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import type { PDFProcessingOptions, ProcessedPDF } from '@/types/pdf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'placeholder',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { processingId, options = {} } = req.body as {
    processingId: string;
    options: PDFProcessingOptions;
  };

  if (!processingId) {
    return res.status(400).json({ error: 'Processing ID required' });
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

  // Get user profile and check usage limits
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  try {
    const inputPath = `/tmp/${processingId}.pdf`;
    const outputPath = `/tmp/${processingId}_processed.pdf`;

    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    // Load PDF to get page count
    const pdfBytes = await fs.readFile(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    // Check usage limits for free users
    if (profile.plan === 'free') {
      const newUsage = profile.usage_this_week + pageCount;
      if (newUsage > 10) {
        return res.status(403).json({ 
          error: 'Weekly page limit exceeded', 
          message: `You've reached your free tier limit of 10 pages per week. Upgrade to Pro for unlimited processing.`,
          currentUsage: profile.usage_this_week,
          pageLimit: 10,
          requestedPages: pageCount
        });
      }
    }

    // Apply transformations
    if (options.rotate) {
      pages.forEach(page => {
        page.setRotation(degrees(options.rotate || 0));
      });
    }

    // Basic compression by optimizing the PDF structure
    const processedPdfBytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });

    // Save processed PDF
    await fs.writeFile(outputPath, processedPdfBytes);

    // Get file stats
    const stats = await fs.stat(outputPath);
    
    const result: ProcessedPDF = {
      id: processingId,
      originalName: `${processingId}.pdf`,
      processedUrl: `/api/download/${processingId}`,
      downloadUrl: `/api/download/${processingId}`,
      pageCount: pages.length,
      fileSize: stats.size,
      processedAt: new Date(),
      options,
    };

    // Update user usage statistics
    const newUsageThisWeek = profile.usage_this_week + pageCount;
    const newTotalProcessed = profile.total_pages_processed + pageCount;

    await supabase
      .from('profiles')
      .update({
        usage_this_week: newUsageThisWeek,
        total_pages_processed: newTotalProcessed,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Record processing history
    await supabase
      .from('processing_history')
      .insert({
        user_id: user.id,
        processing_id: processingId,
        original_filename: `${processingId}.pdf`,
        page_count: pageCount,
        file_size_bytes: stats.size,
        processing_options: options,
        status: 'completed',
        completed_at: new Date().toISOString()
      });

    // Clean up input file
    await fs.unlink(inputPath);

    res.status(200).json({ 
      result,
      usage: {
        pagesProcessedThisWeek: newUsageThisWeek,
        totalPagesProcessed: newTotalProcessed,
        plan: profile.plan
      }
    });
  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: 'Failed to process PDF' });
  }
}