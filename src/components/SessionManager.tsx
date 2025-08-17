import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@/utils/supabase/client';
import { getSessionInfo, refreshSession } from '@/utils/session';

interface SessionManagerProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export default function SessionManager({ children, requireAuth = false }: SessionManagerProps) {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;
    let sessionCheckInterval: NodeJS.Timeout;

    const checkAndRefreshSession = async () => {
      try {
        const sessionInfo = await getSessionInfo();
        
        setIsAuthenticated(sessionInfo.isAuthenticated);
        
        if (!sessionInfo.isAuthenticated) {
          if (requireAuth && router.pathname !== '/auth' && !router.pathname.startsWith('/auth/')) {
            router.push('/auth');
          }
          setSessionChecked(true);
          return;
        }

        // If session needs refresh, do it automatically
        if (sessionInfo.needsRefresh) {
          console.log('Refreshing session...');
          const refreshed = await refreshSession();
          
          if (!refreshed) {
            console.log('Session refresh failed, redirecting to auth');
            setIsAuthenticated(false);
            if (requireAuth) {
              router.push('/auth');
            }
          }
        }

        // Set up next refresh check (every 4 minutes)
        refreshTimer = setTimeout(checkAndRefreshSession, 4 * 60 * 1000);
        
      } catch (error) {
        console.error('Session check error:', error);
        setIsAuthenticated(false);
        if (requireAuth) {
          router.push('/auth');
        }
      } finally {
        setSessionChecked(true);
      }
    };

    // Initial session check
    checkAndRefreshSession();

    // Set up periodic session validation (every 30 seconds)  
    const interval = setInterval(async () => {
      const sessionInfo = await getSessionInfo();
      if (sessionInfo.isAuthenticated !== isAuthenticated) {
        setIsAuthenticated(sessionInfo.isAuthenticated);
        
        if (!sessionInfo.isAuthenticated && requireAuth) {
          router.push('/auth');
        }
      }
    }, 30 * 1000);

    // Listen for auth state changes
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        if (requireAuth) {
          router.push('/auth');
        }
      } else if (event === 'SIGNED_IN' && session) {
        setIsAuthenticated(true);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (interval) clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [requireAuth, router, isAuthenticated]);

  // Show loading while checking session
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth required but not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}