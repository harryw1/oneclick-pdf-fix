import { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { PDFProcessingOptions, ProcessedPDF } from '@/types/pdf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Google Cloud Vision client
const visionClient = new ImageAnnotatorClient(
  process.env.GOOGLE_CREDENTIALS_BASE64
    ? {
        credentials: JSON.parse(
          Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString()
        ),
      }
    : { keyFilename: './google-credentials.json' } // Fallback for local development
);

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
  
  const processingStartTime = Date.now();

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Request body required' });
  }

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

    // Priority processing: Enhanced features for Pro users
    const isPro = profile.plan === 'pro_monthly' || profile.plan === 'pro_annual';
    console.log(`Processing with ${isPro ? 'Pro' : 'Free'} tier features`);

    // Smart rotation detection using Google Cloud Vision API (Pro users get enhanced accuracy)
    let pageRotations: number[] = [0];
    if (options.autoRotate !== false) {
      try {
        pageRotations = await detectOptimalRotationWithVision(pdfBytes, isPro);
        console.log('Vision API rotation analysis complete');
      } catch (error) {
        console.warn('Vision API rotation detection failed:', error);
        pageRotations = [0];
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

    // Document skew detection using Google Cloud Vision API (Pro feature)
    if (options.deskew && isPro) {
      console.log('Applying deskewing with Vision API (Pro feature)...');
      
      try {
        const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
        
        const [result] = await visionClient.documentTextDetection({
          image: {
            content: pdfBase64,
          },
        });

        // Analyze text block orientations to detect skew
        const textAnnotations = result.textAnnotations || [];
        if (textAnnotations.length > 1) {
          let totalSkew = 0;
          let validBlocks = 0;

          // Sample text blocks to calculate average skew angle
          for (let i = 1; i < Math.min(textAnnotations.length, 10); i++) {
            const annotation = textAnnotations[i];
            if (annotation.boundingPoly?.vertices && annotation.boundingPoly.vertices.length >= 4) {
              const vertices = annotation.boundingPoly.vertices;
              const topLeft = vertices[0];
              const topRight = vertices[1];
              
              if (topLeft.x !== undefined && topLeft.y !== undefined && 
                  topRight.x !== undefined && topRight.y !== undefined) {
                const deltaX = topRight.x - topLeft.x;
                const deltaY = topRight.y - topLeft.y;
                const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
                
                if (Math.abs(angle) < 45) { // Ignore extreme angles
                  totalSkew += angle;
                  validBlocks++;
                }
              }
            }
          }

          if (validBlocks > 0) {
            const avgSkew = totalSkew / validBlocks;
            const skewAngle = Math.max(-5, Math.min(5, avgSkew)); // Limit to ±5 degrees
            
            if (Math.abs(skewAngle) > 0.5) {
              pages.forEach((page, index) => {
                const currentRotation = page.getRotation().angle;
                page.setRotation(degrees(currentRotation - skewAngle));
                console.log(`Applied ${skewAngle.toFixed(1)}° skew correction to page ${index + 1}`);
              });
            }
          }
        }
      } catch (error) {
        console.warn('Vision API deskewing failed:', error);
      }
    }

    // Document classification and OCR (Pro features)
    let documentType = 'Unknown';
    if (isPro && (options.ocr || options.classify)) {
      console.log('Processing document classification and OCR with Google Cloud Vision (Pro features)...');
      
      try {
        // Convert PDF to base64 for Vision API
        const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
        
        // Run both document text detection and web entity detection for classification
        const [textResult, entityResult] = await Promise.all([
          visionClient.documentTextDetection({
            image: { content: pdfBase64 }
          }),
          visionClient.webDetection({
            image: { content: pdfBase64 }
          })
        ]);

        // Extract text for OCR
        const fullTextAnnotation = textResult[0].fullTextAnnotation;
        let extractedText = '';
        if (fullTextAnnotation?.text) {
          extractedText = fullTextAnnotation.text;
          console.log(`OCR extracted ${extractedText.length} characters from document`);
        }

        // Classify document type using web entities and text analysis
        documentType = classifyDocument(extractedText, entityResult[0].webDetection);
        console.log(`Document classified as: ${documentType}`);

      } catch (error) {
        console.warn('Google Vision processing failed, falling back to basic processing:', error);
      }
    }

    // Priority processing: Enhanced compression for Pro users
    const compressionOptions = isPro ? {
      useObjectStreams: true,
      addDefaultPage: false,
      objectStreamsVersion: 1,
      updateFieldAppearances: false, // Faster processing
    } : {
      useObjectStreams: options.compress !== false,
      addDefaultPage: false,
    };

    console.log(`Applying ${isPro ? 'enhanced Pro' : 'standard'} compression...`);
    const processedPdfBytes = await pdfDoc.save(compressionOptions);

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
      result: {
        ...result,
        documentType: isPro ? documentType : undefined,
      },
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
async function detectOptimalRotationWithVision(pdfBytes: Uint8Array, isPro: boolean): Promise<number[]> {
  try {
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    
    const [result] = await visionClient.documentTextDetection({
      image: {
        content: pdfBase64,
      },
    });

    // Analyze text block orientations to detect optimal rotation
    const textAnnotations = result.textAnnotations || [];
    if (textAnnotations.length === 0) return [0];

    // Enhanced rotation detection for Pro users
    if (isPro && textAnnotations.length > 1) {
      let bestRotation = 0;
      let maxTextArea = 0;

      // Test different rotations by analyzing text block density
      for (const rotation of [0, 90, 180, 270]) {
        let totalTextArea = 0;
        
        textAnnotations.slice(1, 20).forEach(annotation => {
          if (annotation.boundingPoly?.vertices) {
            const vertices = annotation.boundingPoly.vertices;
            if (vertices.length >= 4) {
              const width = Math.abs((vertices[1].x || 0) - (vertices[0].x || 0));
              const height = Math.abs((vertices[3].y || 0) - (vertices[0].y || 0));
              totalTextArea += width * height;
            }
          }
        });

        if (totalTextArea > maxTextArea) {
          maxTextArea = totalTextArea;
          bestRotation = rotation;
        }
      }
      
      return [bestRotation];
    }

    // Basic rotation for free users (no rotation by default)
    return [0];
  } catch (error) {
    console.error('Vision API rotation detection failed:', error);
    return [0];
  }
}

function classifyDocument(text: string, webDetection: any): string {
  if (!text) return 'Unknown';
  
  const textLower = text.toLowerCase();
  
  // Classification based on content keywords
  if (textLower.includes('resume') || textLower.includes('curriculum vitae') || 
      textLower.includes('experience') && textLower.includes('education')) {
    return 'Resume/CV';
  }
  
  if (textLower.includes('invoice') || textLower.includes('bill') || 
      textLower.includes('amount due') || textLower.includes('payment')) {
    return 'Invoice/Bill';
  }
  
  if (textLower.includes('contract') || textLower.includes('agreement') || 
      textLower.includes('terms and conditions')) {
    return 'Contract/Legal';
  }
  
  if (textLower.includes('report') || textLower.includes('analysis') || 
      textLower.includes('summary') || textLower.includes('findings')) {
    return 'Report/Analysis';
  }
  
  if (textLower.includes('statement') || textLower.includes('account') || 
      textLower.includes('balance') || textLower.includes('transaction')) {
    return 'Financial Statement';
  }
  
  // Use web entities as fallback classification
  if (webDetection?.webEntities) {
    const entities = webDetection.webEntities.slice(0, 3);
    for (const entity of entities) {
      if (entity.description) {
        const desc = entity.description.toLowerCase();
        if (desc.includes('form') || desc.includes('application')) {
          return 'Form/Application';
        }
        if (desc.includes('certificate') || desc.includes('diploma')) {
          return 'Certificate/Diploma';
        }
      }
    }
  }
  
  return 'General Document';
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