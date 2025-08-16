import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import SessionManager from '@/components/SessionManager';
import { useRouter } from 'next/router';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  
  // Pages that require authentication
  const protectedRoutes = ['/dashboard'];
  const requireAuth = protectedRoutes.includes(router.pathname);
  
  return (
    <SessionManager requireAuth={requireAuth}>
      <Component {...pageProps} />
    </SessionManager>
  );
}