import { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showAuth?: boolean;
}

export default function Layout({ 
  children, 
  title = 'OneClick PDF Fixer', 
  description = 'Transform mis-scanned PDFs into perfectly readable documents',
  showAuth = true 
}: LayoutProps) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'pro_monthly' | 'pro_annual'>('free');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (showAuth) {
      const fetchUserData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email || '' });
          setAuthToken(session.access_token);
          
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', session.user.id)
            .single();
            
          setUserPlan(profile?.plan || 'free');
        } else {
          setUser(null);
          setAuthToken(null);
          setUserPlan('free');
        }
      };
      
      fetchUserData();

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email || '' });
          setAuthToken(session.access_token);
          
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', session.user.id)
            .single();
            
          setUserPlan(profile?.plan || 'free');
        } else {
          setUser(null);
          setAuthToken(null);
          setUserPlan('free');
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [showAuth, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleManageSubscription = async () => {
    if (!authToken) return;

    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ action: 'create_portal' })
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        // Show user-friendly error messages
        const message = data.message || 'Failed to open subscription management';
        if (data.supportRequired) {
          alert(`${message} Please email support for assistance.`);
        } else {
          alert(message);
        }
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open subscription management');
    }
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50">
        <header className="glass-effect border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <Link href="/" className="flex items-center space-x-2">
                <div className="h-8 w-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  OneClick PDF Fixer
                </h1>
              </Link>
              
              {showAuth && (
                <div className="flex items-center space-x-3">
                  {user && userPlan !== 'free' ? (
                    <Button variant="ghost" size="sm" onClick={handleManageSubscription}>
                      Manage Subscription
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/pricing">Pricing</Link>
                    </Button>
                  )}
                  {user ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard">Dashboard</Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleSignOut}>
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" asChild>
                      <Link href="/auth">Sign In</Link>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </>
  );
}