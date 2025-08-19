export function getBaseUrl(): string {
  // For production, use the custom domain (www subdomain to match Vercel redirect)
  if (process.env.NODE_ENV === 'production') {
    return 'https://www.oneclickpdf.io';
  }
  
  // For development, use localhost
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // For server-side rendering in development
  return 'http://localhost:3000';
}

export function getAuthRedirectUrl(path: string): string {
  return `${getBaseUrl()}${path}`;
}