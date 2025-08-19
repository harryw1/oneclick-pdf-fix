import { PDFDocument, degrees } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { put } from '@vercel/blob';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';
import type { 
  PDFProcessingOptions, 
  ProcessedPDF
} from '@/types/app';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseApiKey = process.env.SUPABASE_API_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Google Cloud configuration
const hasCredentials = !!process.env.GOOGLE_CREDENTIALS_BASE64;

// Extract project ID and bucket name from service account
function getGoogleCloudConfig() {
  if (!hasCredentials) return null;
  
  try {
    const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64!, 'base64').toString());
    const projectId = credentials.project_id;
    
    if (!projectId) {
      console.error('No project_id found in service account credentials');
      return null;
    }
    
    // Use consistent bucket naming convention: projectId-pdf-processing
    const bucketName = `${projectId}-pdf-processing`;
    
    return { projectId, bucketName, credentials };
  } catch (error) {
    console.error('Failed to parse Google Cloud credentials:', error);
    return null;
  }
}

// Initialize Google Cloud clients
let visionClient: ImageAnnotatorClient | null = null;
let storageClient: Storage | null = null;

function getVisionClient(): ImageAnnotatorClient | null {
  if (!hasCredentials) {
    console.warn('Google Cloud Vision credentials not available');
    return null;
  }
  
  if (!visionClient) {
    try {
      const config = getGoogleCloudConfig();
      if (!config) return null;
      
      visionClient = new ImageAnnotatorClient({ credentials: config.credentials });
      console.log('Google Cloud Vision client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Cloud Vision client:', error);
      return null;
    }
  }
  
  return visionClient;
}

function getStorageClient(): Storage | null {
  if (!hasCredentials) {
    console.warn('Google Cloud Storage credentials not available - Vision API features will be limited');
    return null;
  }
  
  if (!storageClient) {
    try {
      const config = getGoogleCloudConfig();
      if (!config) return null;
      
      storageClient = new Storage({ 
        projectId: config.projectId,
        credentials: config.credentials
      });
      console.log('Google Cloud Storage client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Cloud Storage client:', error);
      return null;
    }
  }
  
  return storageClient;
}

// Main processing function with proper Google Cloud integration
export async function processDocumentWithVision(params: {
  processingId: string;
  blobUrl: string;
  originalFileName: string;
  options: PDFProcessingOptions;
  userId: string;
  userToken?: string;
}): Promise<ProcessedPDF> {
  const startTime = Date.now();
  const { processingId, blobUrl, originalFileName, options, userId, userToken } = params;

  console.log(`Starting PDF processing for: ${processingId}`);

  // Create authenticated supabase client
  const supabase = userToken 
    ? createClient(supabaseUrl!, supabaseAnonKey!, {
        global: { headers: { Authorization: `Bearer ${userToken}` } }
      })
    : createClient(supabaseUrl!, supabaseApiKey!);

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  const isPro = profile.plan === 'pro_monthly' || profile.plan === 'pro_annual';

  // Download PDF from Vercel Blob
  console.log('Downloading PDF from Vercel Blob:', blobUrl);
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

  console.log(`Processing ${pageCount} pages for ${isPro ? 'Pro' : 'Free'} user`);

  // Check usage limits
  await validateUsageLimits(profile, pageCount);

  let documentType = 'PDF Document';
  // let confidenceScore = 0.5; // Future use for confidence display

  // Enhanced processing with Google Vision API (if available and enabled)
  if ((options.ocr || options.autoRotate || options.classify) && hasCredentials) {
    try {
      const visionResult = await processWithGoogleVision(pdfBytes, processingId, isPro, options);
      if (visionResult) {
        documentType = visionResult.documentType;
        // confidenceScore = visionResult.confidenceScore; // Store for future use
        
        // Apply smart rotation based on Vision API results
        if (options.autoRotate && visionResult.suggestedRotation) {
          pages.forEach(page => {
            page.setRotation(degrees(visionResult.suggestedRotation!));
          });
          console.log(`Applied ${visionResult.suggestedRotation}° rotation based on Vision API analysis`);
        }
      }
    } catch (visionError) {
      console.warn('Google Vision API processing failed, continuing with basic processing:', visionError);
    }
  }

  // Apply PDF compression and optimization
  console.log('Applying PDF compression and optimization...');
  const compressionOptions = isPro ? {
    useObjectStreams: true,
    addDefaultPage: false,
    objectStreamsVersion: 1,
    updateFieldAppearances: false,
  } : {
    useObjectStreams: options.compress !== false,
    addDefaultPage: false,
  };

  const processedPdfBytes = await pdfDoc.save(compressionOptions);

  // Upload processed PDF to Vercel Blob with 24-hour expiration
  console.log('Uploading processed PDF to Vercel Blob...');
  const processedBlob = await put(`processed-${processingId}.pdf`, Buffer.from(processedPdfBytes), {
    access: 'public',
    addRandomSuffix: false,
    // Note: Vercel Blob metadata support may be limited
    // Store expiration info in database instead
  });

  const processingDuration = Date.now() - startTime;

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

  console.log(`Processing completed for ${processingId}: ${pageCount} pages in ${processingDuration}ms`);
  return result;
}

// Google Vision API processing with proper GCS integration
async function processWithGoogleVision(
  pdfBytes: Uint8Array, 
  processingId: string, 
  isPro: boolean,
  options: PDFProcessingOptions
): Promise<{ documentType: string; confidenceScore: number; suggestedRotation?: number }> {
  const visionClient = getVisionClient();
  const storageClient = getStorageClient();
  
  if (!visionClient) {
    throw new Error('Vision API client not available');
  }

  // For documents with many pages or when GCS is available, use proper GCS workflow
  const config = getGoogleCloudConfig();
  if (storageClient && config && pdfBytes.length > 5 * 1024 * 1024) { // > 5MB
    console.log('Using Google Cloud Storage for Vision API processing');
    return await processWithGCS(visionClient, storageClient, pdfBytes, processingId, isPro, options);
  } else {
    // Fallback to direct base64 processing for smaller files
    console.log('Using direct base64 processing for Vision API');
    return await processDirectVision(visionClient, pdfBytes, isPro, options);
  }
}

// Process via Google Cloud Storage (recommended approach)
async function processWithGCS(
  visionClient: ImageAnnotatorClient,
  storageClient: Storage,
  pdfBytes: Uint8Array,
  processingId: string,
  isPro: boolean,
  options: PDFProcessingOptions
): Promise<{ documentType: string; confidenceScore: number; suggestedRotation?: number }> {
  
  const config = getGoogleCloudConfig();
  if (!config) {
    throw new Error('Google Cloud configuration not available');
  }
  
  const tempFileName = `temp-pdf-${processingId}.pdf`;
  const bucket = storageClient.bucket(config.bucketName);
  const file = bucket.file(tempFileName);

  try {
    // Upload PDF to GCS temporarily
    console.log('Uploading PDF to Google Cloud Storage for processing...');
    await file.save(Buffer.from(pdfBytes), {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'no-cache'
      }
    });

    const gcsUri = `gs://${config.bucketName}/${tempFileName}`;
    console.log('PDF uploaded to GCS:', gcsUri);

    // Process with Vision API using GCS URI
    const [result] = await visionClient.documentTextDetection({
      image: { source: { imageUri: gcsUri } }
    });

    console.log('Vision API processing completed');

    // Extract results
    let documentType = 'PDF Document';
    let confidenceScore = 0.5;
    let suggestedRotation = 0;

    if (result.fullTextAnnotation?.text) {
      documentType = classifyDocument(result.fullTextAnnotation.text);
      console.log(`Document classified as: ${documentType}`);
    }

    if (result.textAnnotations && result.textAnnotations.length > 0) {
      // Calculate average confidence
      const confidences = result.textAnnotations
        .map(annotation => (annotation as any).confidence)
        .filter(conf => conf !== undefined);
      
      if (confidences.length > 0) {
        confidenceScore = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      }
      
      // Analyze text orientation for rotation suggestion
      if (options.autoRotate) {
        suggestedRotation = analyzeTextOrientation(result.textAnnotations);
      }
    }

    return { documentType, confidenceScore, suggestedRotation };

  } finally {
    // Clean up temporary GCS file
    try {
      await file.delete();
      console.log('Cleaned up temporary GCS file');
    } catch (deleteError) {
      console.warn('Failed to cleanup GCS temp file:', deleteError);
    }
  }
}

// Direct Vision API processing (fallback for smaller files)
async function processDirectVision(
  visionClient: ImageAnnotatorClient,
  pdfBytes: Uint8Array,
  isPro: boolean,
  options: PDFProcessingOptions
): Promise<{ documentType: string; confidenceScore: number; suggestedRotation?: number }> {
  
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  
  console.log('Processing PDF with Vision API (direct base64)');
  
  const [result] = await visionClient.documentTextDetection({
    image: { content: pdfBase64 }
  });

  let documentType = 'PDF Document';
  let confidenceScore = 0.5;
  let suggestedRotation = 0;

  if (result.fullTextAnnotation?.text) {
    documentType = classifyDocument(result.fullTextAnnotation.text);
  }

  if (result.textAnnotations && result.textAnnotations.length > 0) {
    confidenceScore = 0.8; // Default confidence for direct processing
    
    if (options.autoRotate) {
      suggestedRotation = analyzeTextOrientation(result.textAnnotations);
    }
  }

  return { documentType, confidenceScore, suggestedRotation };
}

// Document classification based on text content
function classifyDocument(text: string): string {
  if (!text) return 'PDF Document';
  
  const textLower = text.toLowerCase();
  
  const patterns = [
    { type: 'Invoice', keywords: ['invoice', 'bill', 'amount due', 'payment', 'total', 'tax'], threshold: 2 },
    { type: 'Resume/CV', keywords: ['resume', 'curriculum vitae', 'experience', 'education', 'skills'], threshold: 2 },
    { type: 'Contract', keywords: ['contract', 'agreement', 'terms and conditions', 'whereas', 'party'], threshold: 2 },
    { type: 'Report', keywords: ['report', 'analysis', 'summary', 'findings', 'conclusion'], threshold: 2 },
    { type: 'Financial Statement', keywords: ['statement', 'account', 'balance', 'transaction'], threshold: 2 },
    { type: 'Certificate', keywords: ['certificate', 'diploma', 'certification', 'awarded'], threshold: 1 }
  ];

  for (const pattern of patterns) {
    const matches = pattern.keywords.filter(keyword => textLower.includes(keyword)).length;
    if (matches >= pattern.threshold) {
      return pattern.type;
    }
  }
  
  return 'PDF Document';
}

// Analyze text orientation to suggest rotation
function analyzeTextOrientation(textAnnotations: any[]): number {
  if (textAnnotations.length < 2) return 0;
  
  let horizontalConfidence = 0;
  let verticalConfidence = 0;
  
  // Sample first 10 text annotations to determine orientation
  for (let i = 1; i < Math.min(textAnnotations.length, 11); i++) {
    const annotation = textAnnotations[i];
    if (annotation.boundingPoly?.vertices && annotation.boundingPoly.vertices.length >= 4) {
      const vertices = annotation.boundingPoly.vertices;
      const topLeft = vertices[0];
      const topRight = vertices[1];
      
      if (topLeft.x !== undefined && topRight.x !== undefined && 
          topLeft.y !== undefined && topRight.y !== undefined) {
        const width = Math.abs(topRight.x - topLeft.x);
        const height = Math.abs(vertices[3]?.y - topLeft.y) || 1;
        
        if (width > height) {
          horizontalConfidence++;
        } else {
          verticalConfidence++;
        }
      }
    }
  }
  
  // Suggest 90-degree rotation if more text appears vertically oriented
  if (verticalConfidence > horizontalConfidence * 1.5) {
    return 90;
  }
  
  return 0;
}

// Utility function to validate usage limits
async function validateUsageLimits(profile: any, pageCount: number) {
  if (profile.plan === 'free') {
    const newUsage = (profile.usage_this_week || 0) + pageCount;
    if (newUsage > 50) { // Increased limit for free users
      throw new Error(`Weekly page limit exceeded. You've reached your free tier limit of 50 pages per week.`);
    }
  } else if (profile.plan === 'pro_monthly' || profile.plan === 'pro_annual') {
    const monthlyUsage = profile.usage_this_month || 0;
    const newUsage = monthlyUsage + pageCount;
    
    if (newUsage > 1000) {
      throw new Error(`Monthly page limit exceeded. You've reached your Pro tier limit of 1000 pages per month.`);
    }
  }
}

// Export for backward compatibility
export { processDocumentWithVision as processDocument };