import Head from 'next/head';
import { FileText, Calendar, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { GetServerSideProps } from 'next';

interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro';
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
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
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

  const handleSignOut = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    } else {
      window.location.href = '/';
    }
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
        alert('Failed to open subscription management');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open subscription management');
    }
  };

  return (
    <>
      <Head>
        <title>Dashboard - OneClick PDF Fixer</title>
        <meta name="description" content="Manage your PDF processing history and account" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100/50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <a href="/" className="text-2xl font-bold text-gray-900">OneClick PDF Fixer</a>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Welcome, {user.email}!</span>
                {profile?.plan === 'free' ? (
                  <a href="/pricing" className="btn-primary">Upgrade to Pro</a>
                ) : (
                  <button onClick={handleManageSubscription} className="btn-secondary">
                    Manage Subscription
                  </button>
                )}
                <button onClick={handleSignOut} className="btn-primary">Sign Out</button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">Manage your PDF processing history</p>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-primary-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Pages This Week</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {profile?.usage_this_week || 0} / {profile?.plan === 'pro' ? '∞' : '5'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Calendar className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Plan</p>
                    <p className="text-2xl font-bold text-gray-900 capitalize">{profile?.plan || 'Free'}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Download className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Processed</p>
                    <p className="text-2xl font-bold text-gray-900">{profile?.total_pages_processed || 0}</p>
                  </div>
                </div>
              </div>
            </div>

          {/* Recent Files */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Recent Files</h2>
            </div>
            
            <div className="p-6">
              <div className="text-center text-gray-500 py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No files processed yet</p>
                <a href="/" className="btn-primary mt-4 inline-block">
                  Process Your First PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
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
          cookiesToSet.forEach(({ name, value, options }) => {
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