import Head from 'next/head';
import { FileText, Calendar, Download } from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { GetServerSideProps } from 'next';

interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  usage_this_week: number;
  total_pages_processed: number;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'placeholder',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
  );

  useEffect(() => {
    const getProfile = async () => {
      // Skip if environment variables aren't set (during build)
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'placeholder') {
        console.log('Skipping auth - no env vars');
        setLoading(false);
        return;
      }

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user) {
          setAuthToken(session.access_token);
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (profile) {
            setProfile({
              id: session.user.id,
              email: session.user.email!,
              plan: profile.plan || 'free',
              usage_this_week: profile.usage_this_week || 0,
              total_pages_processed: profile.total_pages_processed || 0
            });
          } else {
            console.error('Profile not found:', profileError);
          }
        } else {
          // No session found - clear state but still stop loading
          setProfile(null);
          setAuthToken(null);
        }
      } catch (error) {
        console.error('Dashboard auth error:', error);
      } finally {
        setLoading(false);
      }
    };

    getProfile();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Refresh profile data instead of reloading page
        setAuthToken(session.access_token);
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (profile) {
          setProfile({
            id: session.user.id,
            email: session.user.email!,
            plan: profile.plan || 'free',
            usage_this_week: profile.usage_this_week || 0,
            total_pages_processed: profile.total_pages_processed || 0
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setAuthToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

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
        alert('Failed to open subscription management');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to open subscription management');
    }
  };

  if (loading) {
    return (
      <AuthWrapper requireAuth={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  return (
    <AuthWrapper requireAuth={true}>
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
                <span className="text-sm text-gray-600">Welcome, {profile?.email}</span>
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
                    {profile?.usage_this_week || 0} / {profile?.plan === 'pro' ? '∞' : '10'}
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
    </AuthWrapper>
  );
}

// Force client-side rendering to avoid build issues with Supabase
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    props: {}
  };
};