import { FileText, Calendar, Download, Clock, ExternalLink, Upload } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
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

interface CachedData<T> {
  data: T | null;
  timestamp: number;
  isLoading: boolean;
}

interface DashboardProps {
  user: {
    id: string;
    email: string;
  };
  profile: UserProfile | null;
}

export default function DashboardPage({ profile: initialProfile }: DashboardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [processingHistory, setProcessingHistory] = useState<ProcessingHistoryItem[]>([]);
  
  // Simple loading states for UI (not used in dependencies)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  
  // Use refs for caching and loading states to avoid dependency loops
  const profileCache = useRef<CachedData<UserProfile>>({
    data: initialProfile,
    timestamp: Date.now(),
    isLoading: false
  });
  
  const historyCache = useRef<CachedData<ProcessingHistoryItem[]>>({
    data: [],
    timestamp: 0,
    isLoading: false
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable function references with proper caching
  const fetchUserProfile = useCallback(async (token: string, forceRefresh = false) => {
    const now = Date.now();
    const CACHE_DURATION = 30000; // 30 seconds
    
    // Check if we have valid cached data
    if (!forceRefresh && 
        profileCache.current.data && 
        (now - profileCache.current.timestamp) < CACHE_DURATION) {
      return;
    }
    
    // Prevent concurrent requests
    if (profileCache.current.isLoading) {
      return;
    }
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    profileCache.current.isLoading = true;
    
    try {
      const response = await fetch('/api/subscription', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: abortControllerRef.current.signal
      });
      
      if (response.ok) {
        const data = await response.json();
        const { data: { session } } = await createClient().auth.getSession();
        
        const newProfile: UserProfile = {
          id: session?.user?.id || '',
          email: session?.user?.email || '',
          plan: data.plan,
          usage_this_week: data.usage_this_week,
          total_pages_processed: data.total_pages_processed
        };
        
        // Update cache and state
        profileCache.current = {
          data: newProfile,
          timestamp: now,
          isLoading: false
        };
        
        setProfile(newProfile);
      } else {
        console.error('Failed to fetch user profile:', response.status, response.statusText);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to fetch user profile:', error);
      }
    } finally {
      profileCache.current.isLoading = false;
      abortControllerRef.current = null;
    }
  }, []); // Stable reference with no dependencies

  const fetchProcessingHistory = useCallback(async (token: string, forceRefresh = false) => {
    const now = Date.now();
    const CACHE_DURATION = 15000; // 15 seconds for more frequent updates
    
    // Check if we have valid cached data
    if (!forceRefresh && 
        historyCache.current.data && 
        (now - historyCache.current.timestamp) < CACHE_DURATION) {
      return;
    }
    
    // Prevent concurrent requests
    if (historyCache.current.isLoading) {
      return;
    }
    
    historyCache.current.isLoading = true;
    setIsHistoryLoading(true);
    
    try {
      const response = await fetch('/api/processing-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const historyData = data.data || [];
        
        // Update cache and state
        historyCache.current = {
          data: historyData,
          timestamp: now,
          isLoading: false
        };
        
        setProcessingHistory(historyData);
      } else {
        console.error('Failed to fetch processing history:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch processing history:', error);
    } finally {
      historyCache.current.isLoading = false;
      setIsHistoryLoading(false);
    }
  }, []); // Stable reference with no dependencies

  // Helper function to calculate file expiration
  const getFileExpiration = (createdAt: string) => {
    const created = new Date(createdAt);
    const expiration = new Date(created.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const now = new Date();
    
    if (expiration <= now) {
      return { expired: true, timeLeft: 'Expired' };
    }
    
    const timeLeft = expiration.getTime() - now.getTime();
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hoursLeft > 0) {
      return { expired: false, timeLeft: `${hoursLeft}h ${minutesLeft}m left` };
    } else {
      return { expired: false, timeLeft: `${minutesLeft}m left` };
    }
  };

  // Initial data fetch - stable, no dependencies
  useEffect(() => {
    const supabase = createClient();
    
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || null;
      setAuthToken(token);
      
      // Fetch initial data if we have a token
      if (token) {
        await Promise.all([
          fetchUserProfile(token),
          fetchProcessingHistory(token)
        ]);
      }
    };
    
    getSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - functions have stable references
  
  // Auth state listener - separate effect for clarity
  useEffect(() => {
    const supabase = createClient();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/';
      } else if (event === 'SIGNED_IN' && session) {
        setAuthToken(session.access_token);
        // Force refresh on sign in
        await Promise.all([
          fetchUserProfile(session.access_token, true),
          fetchProcessingHistory(session.access_token, true)
        ]);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Stable reference, no dependencies - functions have stable references

  // Window focus handler with proper debouncing and caching
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    let lastFocusTime = 0;
    
    const handleFocus = () => {
      const now = Date.now();
      // Only refresh if it's been more than 30 seconds since last focus refresh
      if (now - lastFocusTime < 30000) {
        return;
      }
      
      const currentToken = authToken;
      if (currentToken && !profileCache.current.isLoading && !historyCache.current.isLoading) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          lastFocusTime = now;
          fetchUserProfile(currentToken);
          fetchProcessingHistory(currentToken);
        }, 2000); // 2 second debounce for less aggressive refreshing
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearTimeout(debounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [authToken]); // Only depend on authToken - functions have stable references


  const handleDownload = async (processingId: string, originalFilename: string) => {
    if (!authToken) return;
    
    try {
      const response = await fetch(`/api/download/${processingId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Download failed:', response.status, errorData);
        throw new Error(`Download failed: ${response.status} - ${errorData}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${originalFilename}_fixed.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              <Button asChild>
                <Link href="/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload PDF
                </Link>
              </Button>
              {profile?.plan === 'free' ? (
                <Button variant="outline" asChild>
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
                {isHistoryLoading ? (
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
                    {processingHistory.map((item) => {
                      const expiration = getFileExpiration(item.createdAt);
                      return (
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
                              {item.status === 'completed' && (
                                <>
                                  <span>•</span>
                                  <span className={expiration.expired ? 'text-red-600' : 'text-orange-600'}>
                                    {expiration.timeLeft}
                                  </span>
                                </>
                              )}
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
                            <>
                              {!expiration.expired ? (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleDownload(item.processingId, item.originalFilename)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled>
                                  <Download className="h-3 w-3 mr-1" />
                                  Expired
                                </Button>
                              )}
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/results/${item.processingId}`}>
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View
                                </Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )})}
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