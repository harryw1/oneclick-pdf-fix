# Domain Setup Guide: oneclickpdf.io

## 1. Vercel Domain Configuration

### Add Domain in Vercel Dashboard
1. Go to your Vercel project dashboard
2. Navigate to **Settings > Domains**
3. Add these domains:
   - `oneclickpdf.io` (primary)
   - `www.oneclickpdf.io` (redirect to primary)

### DNS Configuration
Configure your DNS provider (where you bought oneclickpdf.io) with:

**For Root Domain (oneclickpdf.io):**
```
Type: A
Name: @
Value: 76.76.19.61
```

**For WWW Subdomain:**
```
Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

### SSL Certificate
- Vercel will automatically provision SSL certificates
- Wait for DNS propagation (can take up to 24 hours)
- Verify SSL is working at https://oneclickpdf.io

## 2. Supabase Authentication Configuration

### Update Auth Settings in Supabase Dashboard

1. Go to **Authentication > URL Configuration**
2. Update **Site URL** to: `https://oneclickpdf.io`
3. Update **Redirect URLs** to include:
   ```
   https://oneclickpdf.io/auth/confirm
   https://oneclickpdf.io/auth/callback
   https://oneclickpdf.io/**
   ```

### Email Template Configuration

1. Go to **Authentication > Email Templates**
2. Update all email templates to use the new domain:

**Confirm Signup Template:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your account</a></p>
<p>Or copy and paste this URL: {{ .ConfirmationURL }}</p>
```

**Magic Link Template:**
```html
<h2>Your Magic Link</h2>
<p>Follow this link to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to OneClick PDF</a></p>
<p>Or copy and paste this URL: {{ .ConfirmationURL }}</p>
```

**Reset Password Template:**
```html
<h2>Reset Password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
<p>Or copy and paste this URL: {{ .ConfirmationURL }}</p>
```

### SMTP Configuration (Optional but Recommended)

For better email delivery, configure custom SMTP:

1. Go to **Settings > Authentication**
2. Enable **SMTP Settings**
3. Configure with your preferred email service:

**Recommended Services:**
- **Resend**: Easy setup, good deliverability
- **SendGrid**: Reliable, free tier available  
- **AWS SES**: Cost-effective for high volume

Example Resend Configuration:
```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Pass: [Your Resend API Key]
From Email: noreply@oneclickpdf.io
```

## 3. Environment Variables (if needed)

If you have any hardcoded domain references in environment variables, update them:

```env
NEXT_PUBLIC_SITE_URL=https://oneclickpdf.io
SUPABASE_AUTH_EXTERNAL_REDIRECT_URL=https://oneclickpdf.io/auth/confirm
```

## 4. Testing Checklist

After setup, test these flows:

- [ ] User signup with email confirmation
- [ ] User login  
- [ ] Password reset
- [ ] Magic link signin
- [ ] OAuth signin (Google)
- [ ] Email template rendering
- [ ] SSL certificate working
- [ ] WWW redirect working

## 5. DNS Verification Commands

Check your DNS configuration:

```bash
# Check A record
dig oneclickpdf.io A

# Check CNAME record  
dig www.oneclickpdf.io CNAME

# Check SSL
curl -I https://oneclickpdf.io
```

## 6. Troubleshooting

**Common Issues:**

1. **SSL Pending**: Wait for DNS propagation (up to 24 hours)
2. **Email not sending**: Check Supabase logs and SMTP configuration
3. **Redirect loops**: Ensure auth callback URLs are correct
4. **CORS errors**: Update Supabase site URL

**Support Resources:**
- Vercel Domains: https://vercel.com/docs/concepts/projects/domains
- Supabase Auth: https://supabase.com/docs/guides/auth