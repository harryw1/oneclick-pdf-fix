# Resend + Supabase Email Setup Guide for oneclickpdf.io

## Current Issue
- Password reset and magic link emails failing with "Error sending recovery email"
- Using Supabase's default email service (limited to 4 emails/hour, testing only)
- Need proper custom domain email integration

## Solution: Resend-Supabase Integration

### Method 1: Native Resend-Supabase Integration (Recommended)

**Step 1: Set Up Resend Domain**
1. Go to **Resend Dashboard** → **Domains** → **Add Domain**
2. Add `oneclickpdf.io` as your sending domain
3. **Add Required DNS Records** to your domain registrar:
   ```
   # DKIM Records (Resend will provide these specific values)
   Type: CNAME
   Name: [resend-provided-selector]._domainkey
   Value: [resend-provided-value]
   
   # SPF Record  
   Type: TXT
   Name: @
   Value: v=spf1 include:_spf.resend.com ~all
   
   # DMARC Record
   Type: TXT  
   Name: _dmarc
   Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@oneclickpdf.io
   ```
4. **Verify Domain** in Resend (wait for DNS propagation)

**Step 2: Connect to Supabase**
1. In **Resend Dashboard** → **Integrations** → Find **Supabase**
2. Click **Connect** and authorize the integration
3. Select your Supabase project
4. This automatically configures SMTP settings in Supabase

### Method 2: Manual SMTP Configuration (Alternative)

If the native integration doesn't work:

**Step 1: Get Resend SMTP Credentials**
1. In **Resend Dashboard** → **API Keys** → **Create API Key**
2. Copy the API key (this becomes your SMTP password)

**Step 2: Configure Supabase SMTP**
1. Go to **Supabase Dashboard** → **Settings** → **Authentication**
2. Find **SMTP Settings** section
3. Toggle **Enable Custom SMTP**
4. Configure settings:
   ```
   SMTP Host: smtp.resend.com
   SMTP Port: 587
   SMTP User: resend
   SMTP Pass: [Your Resend API Key from Step 1]
   Sender Email: noreply@oneclickpdf.io
   Sender Name: OneClick PDF Fixer
   ```
5. Click **Save**

## Supabase Authentication Configuration

**Critical: Update URL Settings**
1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://oneclickpdf.io`
3. Set **Redirect URLs**:
   ```
   https://oneclickpdf.io/**
   https://www.oneclickpdf.io/**
   https://oneclickpdf.io/auth/confirm
   https://www.oneclickpdf.io/auth/confirm
   https://oneclickpdf.io/auth/callback
   ```

**Email Template Configuration**
1. Go to **Authentication** → **Email Templates**
2. Update all templates to ensure proper branding:
   - **Confirm Signup**: Subject: "Confirm your OneClick PDF account"
   - **Magic Link**: Subject: "Your OneClick PDF sign-in link"  
   - **Reset Password**: Subject: "Reset your OneClick PDF password"
3. Templates should automatically use your custom domain for links

## Vercel Domain Configuration

**Set Primary Domain (Important for Consistency)**
1. Go to **Vercel Dashboard** → **Project** → **Settings** → **Domains**
2. Make sure you have both:
   - `oneclickpdf.io` (set as primary)
   - `www.oneclickpdf.io` (should redirect to apex)
3. **Remove or redirect** any `vercel.app` domains to avoid duplicate content

**Configure Redirects**
Add to `vercel.json` (or create if it doesn't exist):
```json
{
  "redirects": [
    {
      "source": "https://your-project.vercel.app/:path*",
      "destination": "https://oneclickpdf.io/:path*",
      "permanent": true
    }
  ]
}
```

## Testing Checklist

After setup, test these flows **in order**:

### 1. Domain Verification
- [ ] `https://oneclickpdf.io` loads correctly
- [ ] `https://www.oneclickpdf.io` redirects to apex domain
- [ ] SSL certificate is valid
- [ ] DNS records are propagated (use `dig oneclickpdf.io` to verify)

### 2. Email Service Verification
- [ ] Resend domain shows "Verified" status
- [ ] Supabase SMTP test (if available in settings)
- [ ] No error messages in Resend or Supabase logs

### 3. Authentication Flow Testing
Test on the live site (`https://oneclickpdf.io/auth`):
- [ ] **Password Reset**: Enter email → Should see "Password reset email sent!"
- [ ] **Magic Link**: Enter email → Click "Send magic link" → Should see "Magic link sent!"
- [ ] **New User Signup**: Create account → Should see "Check your email to confirm"

### 4. Email Delivery Testing
Check your email inbox:
- [ ] Password reset email received from `noreply@oneclickpdf.io`
- [ ] Magic link email received
- [ ] Signup confirmation email received
- [ ] All links in emails point to `https://oneclickpdf.io/auth/confirm`
- [ ] Email headers show proper authentication (DKIM, SPF pass)

## Troubleshooting

**"Error sending recovery email" still appears:**
1. Check **Supabase Auth Logs** for specific error messages
2. Verify **Site URL** in Supabase matches exactly: `https://oneclickpdf.io`
3. Ensure **DNS propagation** is complete (can take up to 24 hours)
4. Check **Resend Dashboard** for delivery failures or bounces

**Emails not being received:**
1. Check **spam/junk folder**
2. Verify **domain verification** status in Resend
3. Check **DMARC/SPF records** are correctly configured
4. Look for **delivery logs** in Resend dashboard

**Links in emails don't work:**
1. Verify **redirect URLs** in Supabase include both `oneclickpdf.io` and `www.oneclickpdf.io`
2. Test **auth callback** endpoints manually
3. Check browser **network tab** for CORS errors

## Expected Results After Setup

- ✅ Professional emails from `noreply@oneclickpdf.io`
- ✅ Reliable delivery (no 4 email/hour limit)
- ✅ Proper email authentication (DKIM, SPF)
- ✅ Consistent domain experience
- ✅ Enhanced email analytics in Resend dashboard
- ✅ Better email deliverability and lower spam rates

## Environment Variables (If Needed)

Add to Vercel environment variables if using custom implementation:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_DOMAIN=oneclickpdf.io
```

The code is now configured to use `oneclickpdf.io` consistently across all auth flows.