# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Next.js)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Architecture

This is a Next.js 15 application providing PDF processing services with Supabase authentication and Stripe payments.

### Core Processing Flow
1. **Upload** (`/api/upload`) - Handles PDF file uploads using Formidable, stores files in `/tmp` with unique processing IDs
2. **Process** (`/api/process`) - Transforms PDFs using pdf-lib (rotation, compression) and generates processed files
3. **Download** (`/api/download/[id]`) - Serves processed PDFs for download with automatic cleanup

### Key Technologies & Dependencies
- **Frontend**: Next.js 15 with Pages Router, React 18, Tailwind CSS, Radix UI components
- **PDF Processing**: pdf-lib for PDF manipulation, Sharp for image processing, Tesseract.js for OCR (planned)
- **Authentication**: Supabase SSR (@supabase/ssr) for user management and database
- **File Handling**: Formidable for uploads, react-dropzone for drag-and-drop UI
- **Payments**: Stripe integration for subscription management
- **UI**: Lucide React icons, class-variance-authority for component variants

### Authentication Architecture
- **PKCE Flow**: Uses Supabase's PKCE authentication with proper callback handling in `/auth/confirm`
- **Profile Management**: Automatic profile creation on user signup via database trigger
- **Usage Tracking**: Weekly page limits tracked in user profiles (free: 10 pages/week)
- **RLS Policies**: Row Level Security implemented for profiles and processing_history tables

### Database Schema (Supabase)
- `profiles` table: User plans, usage tracking, Stripe integration
- `processing_history` table: Individual job tracking with processing options
- Automatic profile creation trigger on user signup
- Weekly usage reset function for free tier limits

### API Route Security
- All processing routes require Bearer token authentication
- User profile creation fallback if profile doesn't exist
- Usage limit enforcement for free tier users
- 120-second timeout configured for PDF processing operations

### File Processing Pipeline
- Upload validation: PDF only, 100MB max size
- Temporary file storage in `/tmp` with unique processing IDs
- Current features: PDF compression and basic optimization
- Planned features: Deskewing and OCR (marked as TODO in codebase)

### Configuration
- API routes have 120-second timeout configured in `vercel.json`
- Next.js configured with `serverExternalPackages` for Sharp and pdf-lib
- Tailwind CSS with custom animations and glass morphism effects
- Mobile-responsive design with touch-friendly interactions

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- Stripe environment variables for payment processing

### Important Development Notes
- Always use git to track changes atomically and push to main repo
- Use `git push` to sync changes to Vercel deployment
- PDF processing currently implements compression only; deskewing and OCR are planned features
- User profiles are created automatically during first API call if missing
- Authentication uses Supabase's PASSWORD_RECOVERY event for password reset flow detection