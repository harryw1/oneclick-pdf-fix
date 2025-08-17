import { FileText, Calendar, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro_monthly' | 'pro_annual';
  usage_this_week: number;
  total_pages_processed: number;
}

interface DashboardProps {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile | null;
}

export default function DashboardPage({ user, profile: initialProfile }: DashboardProps) {
  const [profile] = useState<UserProfile | null>(initialProfile);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session token
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthToken(session?.access_token || null);
    };
    
    getSession();

    // Listen for auth state changes (for sign out only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/';
      } else if (event === 'SIGNED_IN' && session) {
        setAuthToken(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);


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
        alert('Failed to open subscription management');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open subscription management');
    }
  };

  return (
    <Layout 
      title="Dashboard - OneClick PDF Fixer"
      description="Manage your PDF processing history and account"
    >

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
              <p className="text-muted-foreground">Manage your PDF processing history</p>
            </div>
            <div className="flex items-center space-x-3">
              {profile?.plan === 'free' ? (
                <Button asChild>
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={handleManageSubscription}>
                  Manage Subscription
                </Button>
              )}
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-primary-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Pages This Week</p>
                      <p className="text-2xl font-bold text-foreground">
                        {profile?.usage_this_week || 0} / {(profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual') ? '∞' : '5'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Plan</p>
                      <p className="text-2xl font-bold text-foreground">
                        {profile?.plan === 'pro_monthly' ? 'Pro Monthly' : 
                         profile?.plan === 'pro_annual' ? 'Pro Annual' : 'Free'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Download className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Processed</p>
                      <p className="text-2xl font-bold text-foreground">{profile?.total_pages_processed || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

          {/* Recent Files */}
          <Card>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-medium text-foreground">Recent Files</h2>
              </div>
              
              <div className="p-6">
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="mb-4">No files processed yet</p>
                  <Button asChild>
                    <Link href="/upload">Process Your First PDF</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
    </Layout>
  );
}

// Server-side authentication - prevents infinite loading
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { createServerClient } = await import('@supabase/ssr');
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(context.req.cookies).map(([name, value]) => ({
            name,
            value: value as string,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            if (context.res) {
              context.res.setHeader('Set-Cookie', `${name}=${value}; Path=/; HttpOnly`);
            }
          });
        },
      },
    }
  );
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userProfile = profile ? {
    id: user.id,
    email: user.email!,
    plan: profile.plan || 'free',
    usage_this_week: profile.usage_this_week || 0,
    total_pages_processed: profile.total_pages_processed || 0
  } : null;

  return {
    props: {
      user: {
        id: user.id,
        email: user.email!,
      },
      profile: userProfile,
    },
  };
};