# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server (Next.js)
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Project Architecture

This is a Next.js application that provides PDF processing services with the following key components:

### Core Processing Flow
1. **Upload** (`/api/upload`) - Handles PDF file uploads using Formidable, stores files in `/tmp` with unique processing IDs
2. **Process** (`/api/process`) - Transforms PDFs using pdf-lib (rotation, compression) and generates processed files
3. **Download** (`/api/download/[id]`) - Serves processed PDFs for download

### Key Technologies
- **Frontend**: Next.js with React, Tailwind CSS, Radix UI components
- **PDF Processing**: pdf-lib for PDF manipulation, Sharp for image processing
- **Authentication**: Supabase for user management and database
- **File Handling**: Formidable for uploads, temporary storage in `/tmp`
- **Payments**: Stripe integration for subscription management

### Directory Structure
- `/api/` - Next.js API routes for core functionality
- `/src/components/` - React components including UI library (`/ui/`)
- `/src/pages/` - Next.js pages (index, dashboard, pricing)
- `/src/utils/` - Utility functions for auth, PDF processing, Stripe
- `/types/` - TypeScript type definitions

### Configuration
- API routes have 120-second timeout configured in `vercel.json`
- Next.js configured with `serverExternalPackages` for Sharp and pdf-lib
- Tailwind CSS configured for styling

### Authentication & Database
- Uses Supabase client for authentication and user profiles
- User plans: 'free' (10 pages/week) or 'pro'
- Tracks weekly usage in user profiles

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Stripe-related environment variables for payment processing