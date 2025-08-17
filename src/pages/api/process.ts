import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
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

    // Check usage limits based on plan
    if (profile.plan === 'free') {
      const newUsage = profile.usage_this_week + pageCount;
      if (newUsage > 5) {
        return res.status(403).json({ 
          error: 'Weekly page limit exceeded', 
          message: `You've reached your free tier limit of 5 pages per week. Upgrade to Pro for 100 pages/month + overages.`,
          currentUsage: profile.usage_this_week,
          pageLimit: 5,
          requestedPages: pageCount
        });
      }
    } else if (profile.plan === 'pro_monthly' || profile.plan === 'pro_annual') {
      // Pro users get 100 pages per month
      const monthlyUsage = profile.usage_this_month || 0;
      const newUsage = monthlyUsage + pageCount;
      
      if (newUsage > 100) {
        return res.status(403).json({ 
          error: 'Monthly page limit exceeded', 
          message: `You've reached your Pro tier limit of 100 pages per month. Please contact support for enterprise options.`,
          currentUsage: monthlyUsage,
          pageLimit: 100,
          requestedPages: pageCount
        });
      }
    }

    // Smart rotation detection and correction
    console.log('Detecting optimal page orientations...');
    const convert = pdf2pic.fromBuffer(Buffer.from(pdfBytes), {
      density: 100,
      saveFilename: 'page',
      savePath: '/tmp',
      format: 'png',
      width: 800,
      height: 600
    });

    const pageRotations: number[] = [];
    
    // Process each page for rotation detection
    for (let i = 0; i < Math.min(pages.length, 5); i++) { // Limit to first 5 pages for performance
      try {
        const pageImage = await convert(i + 1, { responseType: 'buffer' });
        const rotation = await detectOptimalRotation(pageImage.buffer);
        pageRotations.push(rotation);
        console.log(`Page ${i + 1} optimal rotation: ${rotation}°`);
      } catch (error) {
        console.warn(`Failed to detect rotation for page ${i + 1}:`, error);
        pageRotations.push(0);
      }
    }

    // Apply smart rotation
    pages.forEach((page, index) => {
      const rotation = pageRotations[index] || pageRotations[0] || 0;
      if (rotation !== 0) {
        page.setRotation(degrees(rotation));
        console.log(`Applied ${rotation}° rotation to page ${index + 1}`);
      }
    });

    // Implement deskewing using image processing
    if (options.deskew) {
      console.log('Applying deskewing...');
      
      for (let i = 0; i < Math.min(pages.length, 3); i++) { // Limit for performance
        try {
          const pageImage = await convert(i + 1, { responseType: 'buffer' });
          const skewAngle = await detectSkewAngle(pageImage.buffer);
          
          if (Math.abs(skewAngle) > 0.5) { // Only correct significant skew
            const page = pages[i];
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees(currentRotation + skewAngle));
            console.log(`Applied ${skewAngle}° skew correction to page ${i + 1}`);
          }
        } catch (error) {
          console.warn(`Failed to deskew page ${i + 1}:`, error);
        }
      }
    }

    // Implement OCR functionality
    if (options.ocr) {
      console.log('Processing OCR for text extraction...');
      
      try {
        const worker = await createWorker('eng');
        
        for (let i = 0; i < Math.min(pages.length, 3); i++) { // Limit for performance
          try {
            const pageImage = await convert(i + 1, { responseType: 'buffer' });
            const { data: { text } } = await worker.recognize(pageImage.buffer);
            
            if (text.trim()) {
              console.log(`OCR extracted ${text.length} characters from page ${i + 1}`);
              // Note: Adding actual text layers to PDF would require more complex implementation
              // For now, we're extracting and logging the text to verify OCR works
            }
          } catch (error) {
            console.warn(`OCR failed for page ${i + 1}:`, error);
          }
        }
        
        await worker.terminate();
        console.log('OCR processing completed');
      } catch (error) {
        console.error('OCR initialization failed:', error);
      }
    }

    // Basic compression by optimizing the PDF structure
    const processedPdfBytes = await pdfDoc.save({
      useObjectStreams: options.compress !== false,
      addDefaultPage: false,
    });

    // Upload processed PDF to blob storage
    console.log('Uploading processed PDF to blob storage...');
    const processedBlob = await put(`processed-${processingId}.pdf`, Buffer.from(processedPdfBytes), {
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
    const newUsageThisMonth = (profile.usage_this_month || 0) + pageCount;
    const newTotalProcessed = profile.total_pages_processed + pageCount;

    const updateData: any = {
      total_pages_processed: newTotalProcessed,
      last_processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Update weekly usage for free users
    if (profile.plan === 'free') {
      updateData.usage_this_week = newUsageThisWeek;
    } else {
      // Update monthly usage for Pro users
      updateData.usage_this_month = newUsageThisMonth;
    }

    const { error: updateError } = await userSupabase
      .from('profiles')
      .update(updateData)
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

    const responseUsage: any = {
      totalPagesProcessed: newTotalProcessed,
      plan: profile.plan
    };

    if (profile.plan === 'free') {
      responseUsage.pagesProcessedThisWeek = newUsageThisWeek;
      responseUsage.weeklyLimit = 5;
    } else {
      responseUsage.pagesProcessedThisMonth = newUsageThisMonth;
      responseUsage.monthlyLimit = 100;
    }

    res.status(200).json({ 
      result,
      usage: responseUsage
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

// Helper function to detect optimal rotation using text detection
async function detectOptimalRotation(imageBuffer: Buffer): Promise<number> {
  try {
    const worker = await createWorker('eng');
    const rotations = [0, 90, 180, 270];
    let bestRotation = 0;
    let bestConfidence = 0;
    
    for (const rotation of rotations) {
      try {
        let processedBuffer = imageBuffer;
        
        if (rotation !== 0) {
          processedBuffer = await sharp(imageBuffer)
            .rotate(rotation)
            .png()
            .toBuffer();
        }
        
        const { data: { confidence } } = await worker.recognize(processedBuffer);
        
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestRotation = rotation;
        }
      } catch (error) {
        console.warn(`Failed to test rotation ${rotation}:`, error);
      }
    }
    
    await worker.terminate();
    return bestRotation;
  } catch (error) {
    console.error('Rotation detection failed:', error);
    return 0;
  }
}

// Helper function to detect skew angle using edge detection
async function detectSkewAngle(imageBuffer: Buffer): Promise<number> {
  try {
    // Convert to grayscale and apply edge detection
    const edges = await sharp(imageBuffer)
      .grayscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Simple skew detection using Hough transform approximation
    // This is a simplified version - production would use more sophisticated algorithms
    const { data, info } = edges;
    const width = info.width;
    const height = info.height;
    
    // Sample horizontal lines and calculate average angle
    let angleSum = 0;
    let validLines = 0;
    
    for (let y = height * 0.2; y < height * 0.8; y += 20) {
      const lineData = [];
      for (let x = 0; x < width; x++) {
        const pixel = data[y * width + x];
        if (pixel > 128) lineData.push(x);
      }
      
      if (lineData.length > width * 0.1) {
        // Calculate line angle (simplified)
        const start = lineData[0];
        const end = lineData[lineData.length - 1];
        const angle = Math.atan2(0, end - start) * (180 / Math.PI);
        angleSum += angle;
        validLines++;
      }
    }
    
    const avgAngle = validLines > 0 ? angleSum / validLines : 0;
    const skewAngle = Math.max(-5, Math.min(5, avgAngle)); // Limit to ±5 degrees
    
    return skewAngle;
  } catch (error) {
    console.error('Skew detection failed:', error);
    return 0;
  }
}