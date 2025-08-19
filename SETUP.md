# OneClick PDF Fix - Enhanced Setup Guide

This guide walks you through setting up the enhanced OneClick PDF Fix application with Google Cloud Vision API integration, real-time progress tracking, and advanced PDF processing capabilities.

## 🚀 New Features

### Enhanced Processing Pipeline
- **Async Google Vision API**: Large document processing with progress tracking
- **Real-time Progress**: Live updates on processing status and queue position
- **Advanced OCR**: Document text extraction with confidence scoring
- **Smart Classification**: Automatic document type detection (invoices, contracts, etc.)
- **Priority Processing**: Pro users get immediate processing, free users queue intelligently

### Improved Dashboard
- **Live Processing Status**: Real-time progress bars and operation tracking
- **Queue Management**: See your position and estimated wait times
- **Enhanced Usage Tracking**: Both weekly and monthly limits with accurate statistics
- **Processing History**: Detailed logs with processing duration and document types

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Vercel Blob storage
- Google Cloud Platform account (for enhanced processing)
- Stripe account (for subscriptions)

## 🔧 Database Setup

### Step 1: Backup Existing Data (If Upgrading)

If you have existing data, run this SQL in your Supabase dashboard first:

```sql
-- Run the backup phase of the migration script
-- Copy from sql/safe-data-migration.sql, Phase 1
```

### Step 2: Reset Database Schema

Run the complete schema reset in your Supabase SQL editor:

```sql
-- Run sql/complete-schema-reset.sql in Supabase Dashboard
-- This creates all tables, functions, and policies
```

### Step 3: Restore Data (If Upgrading)

After the schema reset, restore your data:

```sql
-- Run sql/safe-data-migration.sql, Phase 2
-- This migrates your existing data to the new schema
```

## 🌐 Google Cloud Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Note your Project ID

### Step 2: Enable Required APIs

Enable these APIs in your project:
- Cloud Vision API
- Cloud Storage API

```bash
gcloud services enable vision.googleapis.com storage-component.googleapis.com
```

### Step 3: Create Service Account

1. Go to IAM & Admin > Service Accounts
2. Create a new service account
3. Grant these roles:
   - Cloud Vision API Editor
   - Storage Admin

### Step 4: Create and Download Service Account Key

1. Click on your service account
2. Go to Keys tab
3. Add Key > Create New Key (JSON format)
4. Download and save the JSON file

### Step 5: Create Cloud Storage Bucket

The application will automatically use a bucket named `{project-id}-pdf-processing`. 

First, extract your project ID from your service account JSON:

```bash
node scripts/get-project-id.js path/to/your/service-account.json
```

Then create the bucket:

```bash
gsutil mb -p YOUR_PROJECT_ID gs://YOUR_PROJECT_ID-pdf-processing
```

Or create it through the [Google Cloud Console](https://console.cloud.google.com/storage/browser).

## 🔧 Environment Configuration

Copy `.env.example` to `.env.local` and configure:

### Required Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_public_key
SUPABASE_API_KEY=your_supabase_secret_key

# Google Cloud (Base64 encode your service account JSON)
# Project ID and bucket name are automatically extracted from the service account
GOOGLE_CREDENTIALS_BASE64=base64_encoded_service_account_json

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### Convert Service Account to Base64

```bash
# Linux/macOS
base64 -w 0 /path/to/service-account.json

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\service-account.json"))
```

## 📦 Installation

```bash
# Install dependencies
npm install

# Install additional required packages
npm install @google-cloud/vision@^5.3.3 @google-cloud/storage

# Run type checking
npm run type-check

# Start development server
npm run dev
```

## 🧪 Testing the Setup

### 1. Test Database Functions

Run this in your Supabase SQL editor:

```sql
-- Test user stats function (replace with actual user ID)
SELECT get_user_stats('your-user-id-here');

-- Test usage update function
SELECT update_user_usage_safe('your-user-id-here', 5);
```

### 2. Test Google Cloud Integration

Upload a test PDF and monitor the processing:

1. Go to `/upload`
2. Upload a PDF document
3. Watch the real-time progress in the dashboard
4. Check the Supabase `processing_operations` table for operation logs

### 3. Verify Progress Tracking

1. Start a document processing
2. Open `/dashboard` 
3. You should see real-time progress updates
4. Check Network tab for API calls to `/api/processing-status`

## 🔄 Usage Limits

### Free Tier
- **Weekly Limit**: 10 pages
- **Monthly Limit**: 10 pages  
- **Features**: Basic compression, simple rotation
- **Queue Priority**: Standard (may wait during peak times)

### Pro Tier (Monthly/Annual)
- **Weekly Limit**: Unlimited
- **Monthly Limit**: 1000 pages
- **Features**: Advanced OCR, document classification, priority processing
- **Queue Priority**: High (immediate processing)

## 🚨 Troubleshooting

### Common Issues

#### "Google Cloud Vision credentials not available"
- Verify `GOOGLE_CREDENTIALS_BASE64` is set correctly
- Test base64 decoding: `echo "your_base64_string" | base64 -d`

#### "Processing operation timed out"
- Check Google Cloud quotas and limits
- Verify Cloud Storage bucket permissions
- Check Vercel function timeout limits

#### "Database function not found"
- Ensure you ran the complete schema reset script
- Check function permissions were granted correctly

#### Real-time updates not working
- Verify API endpoints are accessible
- Check browser network console for errors
- Ensure authentication tokens are valid

### Debug Mode

Enable verbose logging in development:

```env
NODE_ENV=development
DEBUG=pdf-processor,vision-api
```

## 📊 Monitoring

### Database Health
Check these queries periodically:

```sql
-- Active processing operations
SELECT COUNT(*) FROM processing_operations WHERE status = 'running';

-- Queue length
SELECT COUNT(*) FROM processing_queue WHERE status = 'queued';

-- Failed operations (investigate if >5%)
SELECT 
  COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0 / COUNT(*) as failure_rate
FROM processing_operations 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Performance Metrics
Monitor these in your application:

- Average processing time per page
- Queue wait times
- Vision API response times
- Error rates by operation type

## 🔐 Security Considerations

- Service account keys have minimal required permissions
- Processing operations are isolated by user
- Temporary files are automatically cleaned up
- Rate limiting prevents abuse
- All API endpoints require authentication

## 📝 API Documentation

### New Endpoints

#### GET `/api/processing-progress/[id]`
Get detailed progress for a specific processing operation.

#### GET `/api/processing-status`
Get overall processing status for the current user.

### Database Functions

#### `get_processing_progress(processing_id)`
Returns comprehensive progress information.

#### `update_user_usage_safe(user_id, page_count)`
Atomically updates usage statistics.

#### `cleanup_expired_operations()`
Cleans up old processing operations (run via cron).

## 🎯 Next Steps

1. **Set up monitoring**: Configure alerts for failed operations
2. **Performance tuning**: Adjust timeouts and batch sizes based on usage
3. **Cost optimization**: Monitor Google Cloud usage and adjust quotas
4. **Backup strategy**: Implement regular database backups
5. **Scaling**: Consider load balancing for high-volume usage

## 🆘 Support

For issues with this setup:

1. Check the troubleshooting section above
2. Review Supabase and Vercel logs
3. Test individual components in isolation
4. Create detailed bug reports with logs and configuration