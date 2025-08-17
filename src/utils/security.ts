import { NextApiResponse } from 'next';

export function setSecurityHeaders(res: NextApiResponse, origin?: string) {
  // CORS Configuration
  const allowedOrigins = [
    'http://localhost:3000',
    'https://oneclick-pdf-fix.vercel.app',
    'https://oneclick-pdf-fix-git-main-harryw1.vercel.app'
  ];

  const requestOrigin = origin || '';
  const allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy for API responses
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'self';"
  );
}

export function validateProcessingId(id: string): boolean {
  const processingIdPattern = /^pdf_\d+_[a-zA-Z0-9]+$/;
  return processingIdPattern.test(id);
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>\"'&]/g, '');
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}