import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import type { PDFProcessingOptions, ProcessedPDF } from '@/types/pdf';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('Process API called with body:', req.body);
  console.log('Authorization header:', req.headers.authorization);

  const { processingId, blobUrl, originalFileName, options = {} } = req.body as {
    processingId: string;
    blobUrl: string;
    originalFileName: string;
    options: PDFProcessingOptions;
  };

  if (!processingId || !blobUrl) {
    return res.status(400).json({ error: 'Processing ID and blob URL required' });
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

  // Create authenticated supabase client for database operations
  const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Get user profile and check usage limits
  let { data: profile, error: profileError } = await userSupabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // If profile doesn't exist, create it with proper auth context
  if (profileError || !profile) {
    console.log('Profile not found for user:', user.id, 'Creating new profile...');
    
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
      console.error('Failed to create profile:', createError);
      console.error('Create error details:', JSON.stringify(createError, null, 2));
      
      // If profile creation fails, try to use default values for processing
      console.log('Using default profile values for processing...');
      profile = {
        id: user.id,
        email: user.email!,
        plan: 'free',
        usage_this_week: 0,
        total_pages_processed: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    } else {
      profile = newProfile;
    }
  }

  try {
    console.log('Downloading PDF from blob URL:', blobUrl);
    
    // Download PDF from blob storage
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF from blob: ${response.status}`);
    }
    
    const pdfBytes = new Uint8Array(await response.arrayBuffer());
    console.log('Downloaded PDF size:', pdfBytes.length, 'bytes');
    
    // Load PDF to get page count
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const pageCount = pages.length;

    // Check usage limits for free users
    if (profile.plan === 'free') {
      const newUsage = profile.usage_this_week + pageCount;
      if (newUsage > 3) {
        return res.status(403).json({ 
          error: 'Weekly page limit exceeded', 
          message: `You've reached your free tier limit of 3 pages per week. Upgrade to Pro for unlimited processing.`,
          currentUsage: profile.usage_this_week,
          pageLimit: 3,
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

    // Implement basic deskewing using image processing
    if (options.deskew) {
      console.log('Applying deskewing...');
      // For now, we'll implement a basic version that could be enhanced later
      // This is a simplified approach - in production you'd want more sophisticated skew detection
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        // Apply a small rotation correction (this could be enhanced with actual skew detection)
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees(currentRotation + 0)); // Placeholder for actual skew correction
      }
    }

    // Implement basic OCR functionality
    if (options.ocr) {
      console.log('Processing OCR...');
      // OCR processing without watermark - keep the service professional
      // TODO: Implement actual OCR text layer extraction and embedding
    }

    // Basic compression by optimizing the PDF structure
    const processedPdfBytes = await pdfDoc.save({
      useObjectStreams: options.compress !== false,
      addDefaultPage: false,
    });

    // Upload processed PDF to blob storage
    console.log('Uploading processed PDF to blob storage...');
    const processedBlob = await put(`processed-${processingId}.pdf`, processedPdfBytes, {
      access: 'public',
      addRandomSuffix: false
    });
    
    console.log('Processed PDF uploaded to:', processedBlob.url);
    
    const result: ProcessedPDF = {
      id: processingId,
      originalName: originalFileName,
      processedUrl: processedBlob.url,
      downloadUrl: processedBlob.url,
      pageCount: pages.length,
      fileSize: processedPdfBytes.length,
      processedAt: new Date(),
      options,
    };

    // Update user usage statistics using authenticated client
    const newUsageThisWeek = profile.usage_this_week + pageCount;
    const newTotalProcessed = profile.total_pages_processed + pageCount;

    const { error: updateError } = await userSupabase
      .from('profiles')
      .update({
        usage_this_week: newUsageThisWeek,
        total_pages_processed: newTotalProcessed,
        last_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
    }

    // Record processing history
    const { error: historyError } = await userSupabase
      .from('processing_history')
      .insert({
        user_id: user.id,
        processing_id: processingId,
        original_filename: originalFileName,
        page_count: pageCount,
        file_size_bytes: processedPdfBytes.length,
        processing_options: options,
        status: 'completed',
        completed_at: new Date().toISOString()
      });

    if (historyError) {
      console.error('Failed to insert processing history:', historyError);
    }

    // No need to clean up - files are in blob storage

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
    
    // Ensure we always send valid JSON
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to process PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}