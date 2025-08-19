# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Next.js)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Architecture

This is a Next.js 14 application providing PDF processing services with Supabase authentication and Stripe payments.

### Core Processing Flow
1. **Upload** (`/api/blob/upload`) - Handles PDF file uploads using Vercel Blob, stores files with unique processing IDs and 24-hour expiration
2. **Process** (`/api/process`) - Transforms PDFs using pdf-lib with Google Vision API integration for advanced OCR and document analysis
3. **Download** (`/api/download/[id]`) - Serves processed PDFs for download with automatic cleanup
4. **Cleanup** (`/api/cleanup-files`) - Automated hourly cleanup job for expired files

### Key Technologies & Dependencies
- **Frontend**: Next.js 14 with Pages Router, React 18, Tailwind CSS, Radix UI components
- **PDF Processing**: pdf-lib for PDF manipulation, Sharp for image processing
- **Google Cloud**: Vision API (@google-cloud/vision) for OCR and document classification, Cloud Storage for large file processing
- **Storage**: Vercel Blob (@vercel/blob) for file storage with 24-hour expiration
- **Authentication**: Supabase SSR (@supabase/ssr) for user management and database
- **File Handling**: react-dropzone for drag-and-drop UI, native file uploads
- **Rate Limiting**: Upstash Redis (@upstash/ratelimit) for upload and processing limits
- **Payments**: Stripe integration for subscription management
- **UI**: Lucide React icons, class-variance-authority for component variants

### Authentication Architecture
- **PKCE Flow**: Uses Supabase's PKCE authentication with proper callback handling in `/auth/confirm`
- **Profile Management**: Automatic profile creation on user signup via database trigger
- **Usage Tracking**: Weekly page limits tracked in user profiles (free: 50 pages/week, pro: 1000 pages/month)
- **RLS Policies**: Row Level Security implemented for profiles and processing_history tables

### Database Schema (Supabase)
- `profiles` table: User plans, usage tracking, Stripe integration
- `processing_history` table: Individual job tracking with processing options
- `processing_queue` table: Priority-based queue management system
- `processing_operations` table: Real-time progress tracking for complex operations
- Automatic profile creation trigger on user signup
- Usage reset functions for both weekly and monthly limits
- Advanced database functions for atomic usage updates and progress tracking

### API Route Security
- All processing routes require Bearer token authentication
- User profile creation fallback if profile doesn't exist
- Usage limit enforcement for free tier users
- 120-second timeout configured for PDF processing operations

### File Processing Pipeline
- Upload validation: PDF only, 100MB max size (50MB for free tier)
- **Vercel Blob storage**: 24-hour file retention with automatic cleanup
- **Legacy endpoint**: `/api/upload` deprecated and returns 410 redirect to `/api/blob/upload`
- **Free tier features**: PDF compression, basic optimization, auto-rotation (50 pages/week)
- **Pro tier features**: Advanced OCR with Google Vision API, document classification, priority processing, enhanced compression (1000 pages/month)
- **Google Cloud Storage bridge**: Large files (>5MB) processed via GCS for Vision API compatibility
- **Document classification**: Invoice, Resume, Contract, Report, Certificate detection
- **Smart auto-rotation**: Vision API-based orientation detection and correction

### Configuration
- API routes have 120-second timeout configured in `vercel.json`
- Next.js configured with `serverExternalPackages` for Sharp and pdf-lib
- Tailwind CSS with custom animations and glass morphism effects
- Mobile-responsive design with touch-friendly interactions

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_API_KEY` - Supabase service role key
- `GOOGLE_CREDENTIALS_BASE64` - Base64 encoded Google Cloud service account JSON (project ID extracted automatically)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL for rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `CRON_SECRET` - Secret for authenticating Vercel cron jobs

### Google Cloud Configuration
- **Automatic project ID extraction**: System extracts project ID from service account JSON automatically
- **Bucket naming**: Uses `{projectId}-pdf-processing` convention
- **GCS Integration**: Large files (>5MB) uploaded to GCS temporarily for Vision API processing
- **Cleanup**: Temporary GCS files are automatically deleted after processing

### Rate Limiting Architecture
- **Upload limits**: 10 uploads per minute per user
- **Processing limits**: Based on user tier and current queue status
- **Redis backend**: Upstash Redis for distributed rate limiting
- **Graceful degradation**: Proper error messages when limits exceeded

### Queue Management System
- **Priority processing**: Pro users bypass queue, free users enter priority queue
- **Real-time progress**: WebSocket-like polling for progress updates
- **Status tracking**: Active operations, queued items, and processing history
- **Automatic cleanup**: Failed or stale operations automatically cleaned up

### Important Development Notes
- Always use git to track changes atomically and push to main repo
- Use `git push` to sync changes to Vercel deployment
- OCR and document classification features are fully implemented with Google Vision API
- User profiles are created automatically during first API call if missing
- Authentication uses Supabase's PKCE flow with proper callback handling

## Domain Configuration Requirements

### Supabase Dashboard Configuration
In your Supabase project dashboard, ensure these redirect URLs are configured:
- `https://oneclickpdf.io/**` - For apex domain requests
- `https://www.oneclickpdf.io/**` - For www subdomain (primary)
- `http://localhost:3000/**` - For local development

### Resend Configuration
1. **Domain Setup**: Configure `mail.oneclickpdf.io` (recommended) or `oneclickpdf.io` in Resend dashboard
2. **Required DNS Records**: Add these records to your domain registrar:
   - **SPF Record**: `v=spf1 include:_spf.resend.com ~all`
   - **DKIM Record**: Use the key provided by Resend dashboard
   - **DMARC Record** (optional): `v=DMARC1; p=quarantine; rua=mailto:dmarc@oneclickpdf.io`
3. **Domain Verification**: Complete verification process in Resend dashboard
4. **From Address**: Use verified domain (e.g., `noreply@mail.oneclickpdf.io`)

### Vercel Configuration
- Domain redirect: `oneclickpdf.io` → `www.oneclickpdf.io` (already configured)
- Ensure `CRON_SECRET` environment variable is set for cleanup job authentication