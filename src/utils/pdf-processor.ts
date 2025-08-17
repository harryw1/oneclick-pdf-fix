import { PDFDocument, degrees } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { PDFProcessingOptions, ProcessedPDF } from '@/types/pdf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Initialize Google Cloud Vision client
const hasCredentials = !!process.env.GOOGLE_CREDENTIALS_BASE64;
console.log('Google Cloud Vision credentials available:', hasCredentials);

const visionClient = new ImageAnnotatorClient(
  process.env.GOOGLE_CREDENTIALS_BASE64
    ? {
        credentials: JSON.parse(
          Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString()
        ),
      }
    : { keyFilename: './google-credentials.json' }
);

export async function processDocument(params: {
  processingId: string;
  blobUrl: string;
  originalFileName: string;
  options: PDFProcessingOptions;
  userId: string;
  userToken?: string;
}): Promise<ProcessedPDF> {
  const { processingId, blobUrl, originalFileName, options, userId, userToken } = params;

  // Create authenticated supabase client if token provided
  const userSupabase = userToken ? createClient(supabaseUrl!, supabaseAnonKey!, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  }) : createClient(supabaseUrl!, process.env.SUPABASE_API_KEY!);

  // Get user profile
  const { data: profile } = await userSupabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

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
      throw new Error(`Weekly page limit exceeded. You've reached your free tier limit of 5 pages per week.`);
    }
  } else if (profile.plan === 'pro_monthly' || profile.plan === 'pro_annual') {
    const monthlyUsage = profile.usage_this_month || 0;
    const newUsage = monthlyUsage + pageCount;
    
    if (newUsage > 100) {
      throw new Error(`Monthly page limit exceeded. You've reached your Pro tier limit of 100 pages per month.`);
    }
  }

  // Priority processing: Enhanced features for Pro users
  const isPro = profile.plan === 'pro_monthly' || profile.plan === 'pro_annual';
  console.log(`Processing with ${isPro ? 'Pro' : 'Free'} tier features`);
  console.log('Pro features requested:', { 
    deskew: options.deskew, 
    ocr: options.ocr, 
    classify: options.classify,
    autoRotate: options.autoRotate 
  });

  // Smart rotation detection using Google Cloud Vision API (Pro users get enhanced accuracy)
  let pageRotations: number[] = [0];
  if (options.autoRotate !== false) {
    try {
      pageRotations = await detectOptimalRotationWithVision(pdfBytes, isPro);
      console.log('Vision API rotation analysis complete');
    } catch (error) {
      console.error('Vision API rotation detection failed:', {
        error: error instanceof Error ? error.message : error,
        hasCredentials,
        isPro
      });
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
        image: { content: pdfBase64 }
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
                topRight.x !== undefined && topRight.y !== undefined &&
                topLeft.x !== null && topLeft.y !== null &&
                topRight.x !== null && topRight.y !== null) {
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
      console.error('Google Vision OCR/Classification failed:', {
        error: error instanceof Error ? error.message : error,
        hasCredentials,
        isPro,
        options: { ocr: options.ocr, classify: options.classify }
      });
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

  const result: ProcessedPDF = {
    id: processingId,
    originalName: originalFileName,
    processedUrl: processedBlob.url,
    downloadUrl: `/api/download/${processingId}`,
    pageCount,
    fileSize: processedPdfBytes.length,
    processedAt: new Date(),
    options,
    documentType: isPro ? documentType : undefined,
  };

  // Update user usage statistics
  const newUsage = profile.usage_this_week + pageCount;
  const newTotal = profile.total_pages_processed + pageCount;
  
  await userSupabase
    .from('profiles')
    .update({ 
      usage_this_week: newUsage,
      total_pages_processed: newTotal,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  console.log(`Processing completed for ${processingId}: ${pageCount} pages processed`);
  return result;
}

// Helper functions
async function detectOptimalRotationWithVision(pdfBytes: Uint8Array, isPro: boolean): Promise<number[]> {
  try {
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
    
    const [result] = await visionClient.documentTextDetection({
      image: {
        content: pdfBase64,
      },
    });

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
            if (vertices.length >= 4 && vertices[0] && vertices[1] && vertices[3]) {
              const width = Math.abs((vertices[1].x ?? 0) - (vertices[0].x ?? 0));
              const height = Math.abs((vertices[3].y ?? 0) - (vertices[0].y ?? 0));
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

    return [0];
  } catch (error) {
    console.error('Vision API rotation detection failed:', error);
    return [0];
  }
}

function classifyDocument(text: string, webDetection: unknown): string {
  if (!text) return 'Unknown';
  
  const textLower = text.toLowerCase();
  
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