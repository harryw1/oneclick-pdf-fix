import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { upload } from '@vercel/blob/client';
import { createClient } from '@/utils/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SimpleFileUpload from '@/components/SimpleFileUpload';
import { ArrowLeft, Shield, Zap, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function UploadPage() {
  const [userPlan, setUserPlan] = useState<'free' | 'pro_monthly' | 'pro_annual'>('free');
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth?redirect=/upload');
        return;
      }

      
      // Set auth token
      setAuthToken(session.access_token);
      
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .single();
        
      setUserPlan(profile?.plan || 'free');
      setLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  const handleFileSelect = async (file: File) => {
    try {
      console.log('=== STARTING BLOB UPLOAD ===');
      console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);

      // Get user session for authentication
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Generate unique processing ID
      const processingId = `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Upload directly to Vercel Blob using client-side upload
      console.log('Uploading file to Vercel Blob...');
      const blob = await upload(`${processingId}.pdf`, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/upload',
        clientPayload: JSON.stringify({
          userId: session.data.session?.user.id,
          authToken: token,
          processingId: processingId,
          originalFileName: file.name
        }),
      });

      console.log('✅ File uploaded successfully to Blob storage');
      console.log('Blob result:', blob);
      
      // Store info for processing page and redirect
      sessionStorage.setItem(`blob_${processingId}`, blob.url);
      sessionStorage.setItem(`filename_${processingId}`, file.name);
      
      // Redirect to processing page
      router.push(`/processing/${processingId}`);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Upload failed. Please try again.');
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

  if (loading) {
    return (
      <Layout title="Upload PDF - OneClick PDF Fixer">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Upload PDF - OneClick PDF Fixer"
      description="Upload your PDF for professional document processing"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Upload Your PDF
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your document and we&apos;ll automatically fix rotation, remove skew, and optimize for clarity.
          </p>
        </div>

        {/* Plan Info */}
        <Card className="mb-8 border-primary-200 bg-primary-50/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {userPlan === 'free' ? (
                  <>
                    <Shield className="h-6 w-6 text-primary-600" />
                    <div>
                      <h3 className="font-semibold text-primary-800">Free Plan</h3>
                      <p className="text-sm text-primary-600">Up to 10MB files • 5 pages per week</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-6 w-6 text-primary-600" />
                    <div>
                      <h3 className="font-semibold text-primary-800">Pro Plan</h3>
                      <p className="text-sm text-primary-600">Up to 100MB files • Unlimited pages • Advanced AI features</p>
                    </div>
                  </>
                )}
              </div>
              {userPlan === 'free' ? (
                <Button size="sm" asChild>
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleManageSubscription}>
                  Manage Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upload Component */}
        <Card className="border-2 border-dashed border-primary-200">
          <CardContent className="p-8">
            <SimpleFileUpload
              onFileSelect={handleFileSelect}
              userPlan={userPlan}
            />
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="p-6">
              <Zap className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Instant Processing</h3>
              <p className="text-sm text-muted-foreground">Most documents processed in under 30 seconds</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-6">
              <Shield className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">Files available for 24 hours, then automatically deleted</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="p-6">
              <Sparkles className="h-8 w-8 text-primary-600 mx-auto mb-3" />
              <h3 className="font-semibold mb-2">AI-Powered</h3>
              <p className="text-sm text-muted-foreground">Advanced algorithms detect and fix document issues</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}