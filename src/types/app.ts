// Application-wide TypeScript type definitions

import { User as SupabaseUser } from '@supabase/supabase-js';

// User Types
export interface AppUser {
  id: string;
  email: string;
}

export interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro_monthly' | 'pro_annual';
  usage_this_week: number;
  usage_this_month?: number;
  total_pages_processed: number;
  stripe_customer_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Convert Supabase User to AppUser
export function toAppUser(user: SupabaseUser | null): AppUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || ''
  };
}

// Google Vision API Types
export interface VisionWebEntity {
  entityId?: string;
  score?: number;
  description?: string;
}

export interface VisionWebDetection {
  webEntities?: VisionWebEntity[];
  webImages?: Array<{ url?: string; score?: number }>;
  webPages?: Array<{ url?: string; score?: number; pageTitle?: string }>;
  webLabels?: Array<{ label?: string; languageCode?: string }>;
}

export interface VisionTextAnnotation {
  description?: string;
  boundingPoly?: {
    vertices?: Array<{ x?: number; y?: number }>;
  };
}

export interface VisionDocumentTextResponse {
  textAnnotations?: VisionTextAnnotation[];
  fullTextAnnotation?: {
    text?: string;
    pages?: Array<{
      blocks?: Array<{
        paragraphs?: Array<{
          words?: Array<{
            symbols?: Array<{
              text?: string;
              boundingBox?: {
                vertices?: Array<{ x?: number; y?: number }>;
              };
            }>;
          }>;
        }>;
      }>;
    }>;
  };
}

export interface VisionWebDetectionResponse {
  webDetection?: VisionWebDetection;
}

// Import and re-export PDF types from existing location
import type { PDFProcessingOptions as _PDFProcessingOptions, ProcessedPDF as _ProcessedPDF } from '../../types/pdf';
export type PDFProcessingOptions = _PDFProcessingOptions;
export type ProcessedPDF = _ProcessedPDF;

// API Response Types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadResponse {
  processingId: string;
  originalName: string;
  fileSize: number;
  message: string;
}

export interface ProcessingResponse {
  result?: ProcessedPDF;
  immediate?: boolean;
  queued?: boolean;
  position?: number;
  estimatedWaitTime?: number;
  usage?: {
    pagesProcessedThisWeek?: number;
    pagesProcessedThisMonth?: number;
    weeklyLimit?: number;
    monthlyLimit?: number;
    remainingPages?: number;
  };
}

// Stripe Types
export interface StripeCheckoutResponse {
  url: string;
}

export interface StripePortalResponse {
  url: string;
}

// Rate Limiting Types
export interface RateLimitResult {
  success: boolean;
  reset?: number;
  remaining?: number;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

// Authentication Types
export interface AuthResponse {
  user?: AppUser;
  session?: { access_token: string; refresh_token: string; expires_at: number; };
  error?: string;
}

export interface EmailVerificationStatus {
  verified: boolean;
  email?: string;
}