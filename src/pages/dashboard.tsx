import { FileText, Calendar, Download, Clock, ExternalLink } from 'lucide-react';
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

interface ProcessingHistoryItem {
  id: string;
  processingId: string;
  originalFilename: string;
  pageCount: number;
  fileSizeBytes: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt: string | null;
  processingOptions: Record<string, unknown>;
}

interface DashboardProps {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile | null;
}

export default function DashboardPage({ profile: initialProfile }: DashboardProps) {
  const [profile] = useState<UserProfile | null>(initialProfile);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [processingHistory, setProcessingHistory] = useState<ProcessingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session token
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAuthToken(session?.access_token || null);
      
      // Fetch processing history if we have a token
      if (session?.access_token) {
        await fetchProcessingHistory(session.access_token);
      }
    };
    
    getSession();

    // Listen for auth state changes (for sign out only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/';
      } else if (event === 'SIGNED_IN' && session) {
        setAuthToken(session.access_token);
        await fetchProcessingHistory(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProcessingHistory = async (token: string) => {
    try {
      setHistoryLoading(true);
      const response = await fetch('/api/processing-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProcessingHistory(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch processing history:', error);
    } finally {
      setHistoryLoading(false);
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
                      <p className="text-sm font-medium text-muted-foreground">
                        {(profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual') ? 'Pages This Week' : 'Pages This Week'}
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        {(profile?.plan === 'pro_monthly' || profile?.plan === 'pro_annual') ? 
                          (profile?.usage_this_week || 0) : 
                          `${profile?.usage_this_week || 0} / 5`}
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
                {historyLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading recent files...</p>
                  </div>
                ) : processingHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="mb-4">No files processed yet</p>
                    <Button asChild>
                      <Link href="/upload">Process Your First PDF</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {processingHistory.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-red-500" />
                          <div>
                            <p className="font-medium text-sm text-foreground">{item.originalFilename}</p>
                            <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                              <span>{item.pageCount} pages</span>
                              <span>•</span>
                              <span>{(item.fileSizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                              <span>•</span>
                              <div className="flex items-center space-x-1">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'completed' ? 'bg-green-100 text-green-800' :
                            item.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.status}
                          </div>
                          {item.status === 'completed' && (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/results/${item.processingId}`}>
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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